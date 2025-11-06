# OpenAI Node.js Library

The OpenAI Node.js library provides convenient access to the OpenAI REST API from TypeScript and JavaScript applications. Built with type safety and developer experience in mind, it offers comprehensive support for chat completions, embeddings, image generation, audio transcription, file operations, fine-tuning, and real-time streaming. The library is generated from OpenAI's OpenAPI specification using Stainless, ensuring accurate types and up-to-date API coverage.

This SDK supports multiple JavaScript runtimes including Node.js 20+, Deno, Bun, Cloudflare Workers, Vercel Edge Runtime, and modern browsers (with explicit opt-in). It provides advanced features like automatic retries with exponential backoff, request timeouts, streaming helpers, webhook verification, structured output parsing with Zod schemas, and automated function calling. The library follows semantic versioning and includes built-in error handling with typed exception classes for different HTTP status codes.

## Client Initialization

Initialize the OpenAI client with API key authentication.

```typescript
import OpenAI from 'openai';

// API key from environment variable (default: OPENAI_API_KEY)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// With custom configuration
const client = new OpenAI({
  apiKey: 'sk-...',
  maxRetries: 3,
  timeout: 30 * 1000, // 30 seconds
  defaultHeaders: { 'X-Custom-Header': 'value' },
  defaultQuery: { 'custom_param': 'value' },
});
```

## Azure OpenAI Client

Use Azure OpenAI services with the AzureOpenAI client.

```typescript
import { AzureOpenAI } from 'openai';
import { getBearerTokenProvider, DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const scope = 'https://cognitiveservices.azure.com/.default';
const azureADTokenProvider = getBearerTokenProvider(credential, scope);

const client = new AzureOpenAI({
  azureADTokenProvider,
  apiVersion: '2024-10-01-preview',
  deployment: 'gpt-4o',
});

try {
  const result = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Say hello!' }],
  });
  console.log(result.choices[0]?.message?.content);
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    console.error(`API Error: ${error.status} - ${error.message}`);
  }
  throw error;
}
```

## Responses API (New Standard)

Generate text using the new Responses API with instructions and input.

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function generateResponse() {
  try {
    const response = await client.responses.create({
      model: 'gpt-4o',
      instructions: 'You are a coding assistant that talks like a pirate',
      input: 'Are semicolons optional in JavaScript?',
    });

    console.log(response.output_text);
    console.log(`Request ID: ${response._request_id}`);

    // With streaming
    const stream = await client.responses.create({
      model: 'gpt-4o',
      input: 'Count to five',
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        process.stdout.write(event.delta);
      }
    }
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError) {
      console.error('Rate limit exceeded, waiting before retry...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    } else if (error instanceof OpenAI.APIConnectionError) {
      console.error('Connection error, check network:', error.message);
    } else {
      throw error;
    }
  }
}

generateResponse();
```

## Chat Completions API

Create chat completions with message history and system instructions.

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function chatCompletion() {
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'developer', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is the capital of France?' },
      ],
      max_tokens: 100,
      temperature: 0.7,
      top_p: 1,
      n: 1,
    });

    console.log(completion.choices[0]?.message?.content);
    console.log(`Tokens used: ${completion.usage?.total_tokens}`);
    console.log(`Request ID: ${completion._request_id}`);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`Status: ${error.status}`);
      console.error(`Request ID: ${error.request_id}`);
      console.error(`Message: ${error.message}`);
    }
    throw error;
  }
}

chatCompletion();
```

## Streaming Chat Completions

Stream chat completion responses with event handlers.

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function streamingChat() {
  // Basic streaming with async iterator
  const stream = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Write a haiku about TypeScript' }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(content);
  }
  process.stdout.write('\n');

  // Advanced streaming with runner helpers
  const runner = client.chat.completions
    .stream({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Explain async/await' }],
    })
    .on('connect', () => console.log('Connected to OpenAI'))
    .on('content', (delta, snapshot) => {
      process.stdout.write(delta);
    })
    .on('message', (message) => console.log('\nMessage:', message.role))
    .on('chatCompletion', (completion) => {
      console.log('\nFinish reason:', completion.choices[0]?.finish_reason);
    })
    .on('finalContent', (content) => console.log('\nFinal:', content))
    .on('error', (error) => console.error('Stream error:', error))
    .on('end', () => console.log('\nStream ended'));

  const result = await runner.finalChatCompletion();
  console.log(`Total tokens: ${result.usage?.total_tokens}`);
}

streamingChat();
```

## Structured Output Parsing with Zod

Parse chat completions into typed objects using Zod schemas.

```typescript
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const client = new OpenAI();

const Step = z.object({
  explanation: z.string(),
  output: z.string(),
});

const MathResponse = z.object({
  steps: z.array(Step),
  final_answer: z.string(),
});

async function structuredParsing() {
  try {
    const completion = await client.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: 'You are a helpful math tutor.' },
        { role: 'user', content: 'solve 8x + 31 = 2' },
      ],
      response_format: zodResponseFormat(MathResponse, 'math_response'),
    });

    const message = completion.choices[0]?.message;
    if (message?.parsed) {
      console.log('Steps:');
      message.parsed.steps.forEach((step, i) => {
        console.log(`${i + 1}. ${step.explanation}`);
        console.log(`   Output: ${step.output}`);
      });
      console.log(`\nFinal Answer: ${message.parsed.final_answer}`);
    } else if (message?.refusal) {
      console.log('Model refused:', message.refusal);
    }
  } catch (error) {
    if (error instanceof OpenAI.LengthFinishReasonError) {
      console.error('Response truncated due to length');
    } else if (error instanceof OpenAI.ContentFilterFinishReasonError) {
      console.error('Response blocked by content filter');
    }
    throw error;
  }
}

structuredParsing();
```

## Function Tool Calls with Zod

Define and execute function tools with automatic parsing and validation.

```typescript
import OpenAI from 'openai';
import { zodFunction } from 'openai/helpers/zod';
import { z } from 'zod';

const client = new OpenAI();

const Query = z.object({
  table_name: z.enum(['orders', 'customers', 'products']),
  columns: z.array(z.string()),
  conditions: z.array(z.object({
    column: z.string(),
    operator: z.enum(['=', '>', '<', '<=', '>=', '!=']),
    value: z.union([z.string(), z.number()]),
  })),
  order_by: z.enum(['asc', 'desc']),
});

async function functionToolCalls() {
  const completion = await client.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      {
        role: 'system',
        content: 'You help users query data by calling the query function.',
      },
      {
        role: 'user',
        content: 'Get all orders from last month ordered by date descending',
      },
    ],
    tools: [zodFunction({ name: 'query', parameters: Query })],
  });

  const toolCall = completion.choices[0]?.message.tool_calls?.[0];
  if (toolCall?.type === 'function') {
    const args = toolCall.function.parsed_arguments as z.infer<typeof Query>;
    console.log('Tool:', toolCall.function.name);
    console.log('Table:', args.table_name);
    console.log('Columns:', args.columns);
    console.log('Conditions:', args.conditions);
    console.log('Order:', args.order_by);
  }
}

functionToolCalls();
```

## Automated Function Calling

Automatically execute JavaScript functions based on model tool calls.

```typescript
import OpenAI from 'openai';
import { RunnableToolFunction } from 'openai/lib/RunnableFunction';

const client = new OpenAI();

const tools: RunnableToolFunction<any>[] = [
  {
    type: 'function',
    function: {
      name: 'getCurrentWeather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
        },
        required: ['location'],
      },
      function: async (args: { location: string; unit?: string }) => {
        // Simulate API call
        return {
          location: args.location,
          temperature: 22,
          unit: args.unit || 'celsius',
          condition: 'sunny',
        };
      },
      parse: JSON.parse,
    },
  },
  {
    type: 'function',
    function: {
      name: 'getWeatherForecast',
      description: 'Get weather forecast for next N days',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          days: { type: 'number', minimum: 1, maximum: 7 },
        },
        required: ['location', 'days'],
      },
      function: async (args: { location: string; days: number }) => {
        return {
          location: args.location,
          forecast: Array.from({ length: args.days }, (_, i) => ({
            day: i + 1,
            high: 20 + Math.random() * 10,
            low: 15 + Math.random() * 5,
          })),
        };
      },
      parse: JSON.parse,
    },
  },
];

async function autoFunctionCalling() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: "What's the weather in Tokyo and the forecast for next 3 days?" },
      ],
      tools: tools,
      max_tokens: 500,
    })
    .on('message', (msg) => console.log('Message:', msg.role, msg.content || ''))
    .on('functionToolCall', (call) => {
      console.log(`\nCalling function: ${call.name}`);
      console.log(`Arguments: ${call.arguments}`);
    })
    .on('functionToolCallResult', (result) => {
      console.log(`Function result: ${result}`);
    })
    .on('content', (delta) => process.stdout.write(delta))
    .on('error', (error) => console.error('Error:', error));

  const finalCompletion = await runner.finalChatCompletion();
  console.log(`\n\nTotal messages: ${runner.messages.length}`);
  console.log(`Tokens: ${finalCompletion.usage?.total_tokens}`);

  // Access the full message history
  runner.messages.forEach((msg, i) => {
    console.log(`${i}. ${msg.role}: ${msg.content || '[tool call]'}`);
  });
}

autoFunctionCalling();
```

## Embeddings

Generate vector embeddings for text inputs.

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function createEmbeddings() {
  try {
    // Single embedding
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'The quick brown fox jumps over the lazy dog',
      encoding_format: 'float',
    });

    console.log(`Embedding dimensions: ${response.data[0]?.embedding.length}`);
    console.log(`First 5 values: ${response.data[0]?.embedding.slice(0, 5)}`);
    console.log(`Tokens used: ${response.usage.total_tokens}`);

    // Batch embeddings
    const batchResponse = await client.embeddings.create({
      model: 'text-embedding-3-large',
      input: [
        'Document one content',
        'Document two content',
        'Document three content',
      ],
      dimensions: 256, // Optional: reduce dimensions
    });

    batchResponse.data.forEach((item, i) => {
      console.log(`Embedding ${i}: ${item.embedding.length} dimensions`);
    });
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`Error creating embeddings: ${error.message}`);
    }
    throw error;
  }
}

createEmbeddings();
```

## Image Generation

Generate images from text prompts with DALL-E models.

```typescript
import OpenAI from 'openai';
import fs from 'fs';
import fetch from 'node-fetch';

const client = new OpenAI();

async function generateImages() {
  try {
    // Generate image with URL response
    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt: 'A serene mountain landscape at sunset with a crystal clear lake',
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
      response_format: 'url',
    });

    console.log(`Generated image URL: ${response.data[0]?.url}`);
    console.log(`Revised prompt: ${response.data[0]?.revised_prompt}`);

    // Download the image
    const imageUrl = response.data[0]?.url;
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl);
      const buffer = await imageResponse.buffer();
      fs.writeFileSync('generated-image.png', buffer);
      console.log('Image saved to generated-image.png');
    }

    // Generate with base64 response
    const base64Response = await client.images.generate({
      model: 'dall-e-2',
      prompt: 'A cute robot playing chess',
      n: 2,
      size: '512x512',
      response_format: 'b64_json',
    });

    base64Response.data.forEach((item, i) => {
      if (item.b64_json) {
        const buffer = Buffer.from(item.b64_json, 'base64');
        fs.writeFileSync(`robot-${i}.png`, buffer);
        console.log(`Saved robot-${i}.png`);
      }
    });
  } catch (error) {
    if (error instanceof OpenAI.BadRequestError) {
      console.error('Invalid prompt or parameters:', error.message);
    }
    throw error;
  }
}

generateImages();
```

## Image Editing and Variations

Edit existing images or create variations with DALL-E.

```typescript
import OpenAI from 'openai';
import fs from 'fs';

const client = new OpenAI();

async function editAndVariateImages() {
  // Edit an image with a mask
  const editResponse = await client.images.edit({
    model: 'dall-e-2',
    image: fs.createReadStream('original.png'),
    mask: fs.createReadStream('mask.png'), // Optional: transparent areas to edit
    prompt: 'Add a rainbow in the sky',
    n: 1,
    size: '1024x1024',
  });

  console.log(`Edited image URL: ${editResponse.data[0]?.url}`);

  // Create variations of an image
  const variationResponse = await client.images.createVariation({
    model: 'dall-e-2',
    image: fs.createReadStream('reference.png'),
    n: 3,
    size: '512x512',
    response_format: 'url',
  });

  variationResponse.data.forEach((variation, i) => {
    console.log(`Variation ${i + 1}: ${variation.url}`);
  });
}

editAndVariateImages();
```

## Audio Transcription

Transcribe audio files to text using Whisper models.

```typescript
import OpenAI from 'openai';
import fs from 'fs';

const client = new OpenAI();

async function transcribeAudio() {
  try {
    // Basic transcription
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream('audio.mp3'),
      model: 'whisper-1',
      language: 'en',
      response_format: 'json',
    });

    console.log('Transcription:', transcription.text);

    // Verbose transcription with timestamps
    const verboseTranscription = await client.audio.transcriptions.create({
      file: fs.createReadStream('audio.mp3'),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    console.log(`Language: ${verboseTranscription.language}`);
    console.log(`Duration: ${verboseTranscription.duration}s`);

    verboseTranscription.segments?.forEach((segment) => {
      console.log(`[${segment.start}s - ${segment.end}s] ${segment.text}`);
    });

    verboseTranscription.words?.forEach((word) => {
      console.log(`${word.word} (${word.start}s - ${word.end}s)`);
    });
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`Transcription error: ${error.message}`);
    }
    throw error;
  }
}

transcribeAudio();
```

## Audio Translation and Speech Synthesis

Translate audio to English and convert text to speech.

```typescript
import OpenAI from 'openai';
import fs from 'fs';

const client = new OpenAI();

async function audioTranslationAndSpeech() {
  // Translate audio to English
  const translation = await client.audio.translations.create({
    file: fs.createReadStream('german-audio.mp3'),
    model: 'whisper-1',
    response_format: 'json',
  });

  console.log('Translation:', translation.text);

  // Convert text to speech
  const speechResponse = await client.audio.speech.create({
    model: 'tts-1-hd',
    voice: 'alloy', // alloy, echo, fable, onyx, nova, shimmer
    input: 'Hello! This is a test of the text to speech system.',
    speed: 1.0,
    response_format: 'mp3',
  });

  // Save the audio file
  const buffer = Buffer.from(await speechResponse.arrayBuffer());
  fs.writeFileSync('speech-output.mp3', buffer);
  console.log('Speech saved to speech-output.mp3');

  // Stream speech directly
  const streamResponse = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: 'Streaming audio example',
  });

  const stream = streamResponse.body;
  const writeStream = fs.createWriteStream('streamed-speech.mp3');
  stream.pipe(writeStream);

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
  console.log('Streamed speech saved');
}

audioTranslationAndSpeech();
```

## File Operations

Upload, retrieve, list, and delete files for fine-tuning and assistants.

```typescript
import OpenAI from 'openai';
import fs from 'fs';

const client = new OpenAI();

async function fileOperations() {
  try {
    // Upload a file
    const uploadedFile = await client.files.create({
      file: fs.createReadStream('training-data.jsonl'),
      purpose: 'fine-tune',
    });

    console.log(`File uploaded: ${uploadedFile.id}`);
    console.log(`Filename: ${uploadedFile.filename}`);
    console.log(`Size: ${uploadedFile.bytes} bytes`);
    console.log(`Status: ${uploadedFile.status}`);

    // Wait for file processing
    const processedFile = await client.files.waitForProcessing(uploadedFile.id, {
      pollInterval: 5000, // Check every 5 seconds
      maxWait: 5 * 60 * 1000, // Wait up to 5 minutes
    });

    console.log(`File processed: ${processedFile.status}`);

    // List all files
    const fileList = await client.files.list({
      purpose: 'fine-tune',
    });

    for await (const file of fileList) {
      console.log(`- ${file.filename} (${file.id}): ${file.status}`);
    }

    // Retrieve file details
    const fileDetails = await client.files.retrieve(uploadedFile.id);
    console.log('File details:', fileDetails);

    // Download file content
    const fileContent = await client.files.content(uploadedFile.id);
    const contentBuffer = Buffer.from(await fileContent.arrayBuffer());
    fs.writeFileSync('downloaded-file.jsonl', contentBuffer);
    console.log('File content downloaded');

    // Delete file
    const deleteResponse = await client.files.delete(uploadedFile.id);
    console.log(`File deleted: ${deleteResponse.deleted}`);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`File operation error: ${error.message}`);
    }
    throw error;
  }
}

fileOperations();
```

## Fine-Tuning Jobs

Create and manage fine-tuning jobs for custom models.

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function fineTuningOperations() {
  try {
    // Create a fine-tuning job
    const fineTuneJob = await client.fineTuning.jobs.create({
      model: 'gpt-4o-2024-08-06',
      training_file: 'file-abc123',
      validation_file: 'file-def456',
      hyperparameters: {
        n_epochs: 3,
        batch_size: 4,
        learning_rate_multiplier: 0.1,
      },
      suffix: 'my-custom-model',
      integrations: [
        {
          type: 'wandb',
          wandb: {
            project: 'my-fine-tune-project',
            tags: ['production', 'v1'],
          },
        },
      ],
    });

    console.log(`Fine-tune job created: ${fineTuneJob.id}`);
    console.log(`Status: ${fineTuneJob.status}`);

    // Retrieve job status
    const jobStatus = await client.fineTuning.jobs.retrieve(fineTuneJob.id);
    console.log(`Current status: ${jobStatus.status}`);
    console.log(`Training steps: ${jobStatus.trained_tokens}`);

    // List all fine-tuning jobs
    const jobs = await client.fineTuning.jobs.list({ limit: 10 });
    for await (const job of jobs) {
      console.log(`Job ${job.id}: ${job.status} - Model: ${job.fine_tuned_model || 'pending'}`);
    }

    // Stream job events
    const events = await client.fineTuning.jobs.listEvents(fineTuneJob.id);
    for await (const event of events) {
      console.log(`[${event.created_at}] ${event.message}`);
    }

    // List job checkpoints
    const checkpoints = await client.fineTuning.jobs.checkpoints.list(fineTuneJob.id);
    for await (const checkpoint of checkpoints) {
      console.log(`Checkpoint ${checkpoint.id}: Step ${checkpoint.step_number}`);
      console.log(`Metrics:`, checkpoint.metrics);
    }

    // Cancel a job
    const canceledJob = await client.fineTuning.jobs.cancel(fineTuneJob.id);
    console.log(`Job canceled: ${canceledJob.status}`);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`Fine-tuning error: ${error.message}`);
    }
    throw error;
  }
}

fineTuningOperations();
```

## Vector Stores

Create and manage vector stores for semantic search.

```typescript
import OpenAI from 'openai';
import fs from 'fs';

const client = new OpenAI();

async function vectorStoreOperations() {
  try {
    // Create a vector store
    const vectorStore = await client.vectorStores.create({
      name: 'product-documentation',
      expires_after: {
        anchor: 'last_active_at',
        days: 30,
      },
      chunking_strategy: {
        type: 'static',
        static: {
          max_chunk_size_tokens: 800,
          chunk_overlap_tokens: 400,
        },
      },
      metadata: { version: '1.0', category: 'docs' },
    });

    console.log(`Vector store created: ${vectorStore.id}`);

    // Upload and add files
    const file = await client.vectorStores.files.upload(
      vectorStore.id,
      fs.createReadStream('documentation.pdf')
    );

    console.log(`File uploaded: ${file.id}`);

    // Wait for file processing
    const processedFile = await client.vectorStores.files.uploadAndPoll(
      vectorStore.id,
      fs.createReadStream('guide.pdf')
    );

    console.log(`File status: ${processedFile.status}`);

    // Batch upload multiple files
    const fileList = [
      fs.createReadStream('doc1.pdf'),
      fs.createReadStream('doc2.pdf'),
      fs.createReadStream('doc3.pdf'),
    ];

    const batch = await client.vectorStores.fileBatches.uploadAndPoll(
      vectorStore.id,
      { files: fileList }
    );

    console.log(`Batch status: ${batch.status}`);
    console.log(`Files processed: ${batch.file_counts.completed}/${batch.file_counts.total}`);

    // Search the vector store
    const searchResults = await client.vectorStores.search(vectorStore.id, {
      query: 'How do I configure authentication?',
      limit: 5,
    });

    for await (const result of searchResults) {
      console.log(`Score: ${result.score}`);
      console.log(`Content: ${result.content.substring(0, 200)}...`);
      console.log(`File: ${result.file_id}`);
    }

    // List files in vector store
    const files = await client.vectorStores.files.list(vectorStore.id);
    for await (const file of files) {
      console.log(`File: ${file.id} - Status: ${file.status}`);
    }

    // Update vector store
    const updated = await client.vectorStores.update(vectorStore.id, {
      name: 'updated-documentation',
      metadata: { version: '2.0' },
    });

    console.log(`Vector store updated: ${updated.name}`);

    // Delete file from vector store
    await client.vectorStores.files.del(vectorStore.id, file.id);
    console.log('File deleted from vector store');

    // Delete vector store
    const deleted = await client.vectorStores.delete(vectorStore.id);
    console.log(`Vector store deleted: ${deleted.deleted}`);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`Vector store error: ${error.message}`);
    }
    throw error;
  }
}

vectorStoreOperations();
```

## Realtime API with WebSocket

Build low-latency conversational experiences with real-time audio and text.

```typescript
import { OpenAIRealtimeWS } from 'openai/realtime/ws';
import fs from 'fs';

const rt = new OpenAIRealtimeWS({
  model: 'gpt-realtime',
  apiKey: process.env.OPENAI_API_KEY,
});

// Handle connection events
rt.socket.on('open', () => {
  console.log('WebSocket connection opened');

  // Configure session
  rt.send({
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: 'You are a helpful assistant.',
      voice: 'alloy',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1',
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get current weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
          },
        },
      ],
    },
  });

  // Send a text message
  rt.send({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'What is the weather like?' }],
    },
  });

  // Send audio data
  const audioBuffer = fs.readFileSync('audio.pcm');
  rt.send({
    type: 'input_audio_buffer.append',
    audio: audioBuffer.toString('base64'),
  });

  rt.send({ type: 'input_audio_buffer.commit' });
  rt.send({ type: 'response.create' });
});

// Handle realtime events
rt.on('error', (err) => {
  console.error('Error:', err.message);
});

rt.on('session.created', (event) => {
  console.log('Session created:', event.session.id);
});

rt.on('response.text.delta', (event) => {
  process.stdout.write(event.delta);
});

rt.on('response.text.done', (event) => {
  console.log('\nText response done:', event.text);
});

rt.on('response.audio.delta', (event) => {
  // Handle audio chunks
  const audioChunk = Buffer.from(event.delta, 'base64');
  // Play or save audio chunk
});

rt.on('response.audio_transcript.delta', (event) => {
  process.stdout.write(event.delta);
});

rt.on('response.function_call_arguments.done', (event) => {
  console.log('Function call:', event.name);
  console.log('Arguments:', event.arguments);

  // Send function response
  rt.send({
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: event.call_id,
      output: JSON.stringify({ temperature: 72, condition: 'sunny' }),
    },
  });

  rt.send({ type: 'response.create' });
});

rt.on('response.done', (event) => {
  console.log('Response completed:', event.response.status);
  rt.close();
});

rt.socket.on('close', () => {
  console.log('Connection closed');
});
```

## Webhook Verification

Verify and parse webhook payloads from OpenAI.

```typescript
import OpenAI from 'openai';
import express from 'express';

const client = new OpenAI({
  webhookSecret: process.env.OPENAI_WEBHOOK_SECRET,
});

const app = express();

app.post('/webhooks/openai', express.raw({ type: 'application/json' }), async (req, res) => {
  const body = req.body.toString();
  const headers = req.headers;

  try {
    // Verify and parse webhook in one step
    const event = client.webhooks.unwrap(body, headers);

    switch (event.type) {
      case 'response.completed':
        console.log('Response completed:', event.data.id);
        console.log('Output:', event.data.output);
        break;

      case 'response.failed':
        console.error('Response failed:', event.data.error);
        break;

      case 'fine_tuning.job.succeeded':
        console.log('Fine-tuning succeeded:', event.data.id);
        console.log('Model:', event.data.fine_tuned_model);
        break;

      case 'fine_tuning.job.failed':
        console.error('Fine-tuning failed:', event.data.error);
        break;

      case 'batch.completed':
        console.log('Batch completed:', event.data.id);
        console.log('Results:', event.data.output_file_id);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    res.json({ message: 'ok' });
  } catch (error) {
    console.error('Invalid webhook signature:', error);
    res.status(400).send('Invalid signature');
  }
});

// Verify webhook separately if needed
app.post('/webhooks/verify-only', express.raw({ type: 'application/json' }), (req, res) => {
  const body = req.body.toString();
  const headers = req.headers;

  try {
    client.webhooks.verifySignature(body, headers);
    const event = JSON.parse(body);
    console.log('Verified event:', event.type);
    res.json({ verified: true });
  } catch (error) {
    console.error('Signature verification failed:', error);
    res.status(400).json({ verified: false });
  }
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
```

## Content Moderation

Check text and images for policy violations.

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function moderateContent() {
  try {
    // Moderate text
    const textModeration = await client.moderations.create({
      model: 'omni-moderation-latest',
      input: 'Text content to check for policy violations',
    });

    const result = textModeration.results[0];
    console.log('Flagged:', result.flagged);
    console.log('Categories:', result.categories);
    console.log('Category scores:', result.category_scores);

    if (result.flagged) {
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category]) => category);
      console.log('Flagged for:', flaggedCategories.join(', '));
    }

    // Moderate image
    const imageModeration = await client.moderations.create({
      model: 'omni-moderation-latest',
      input: [
        { type: 'text', text: 'Description of the image' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } },
      ],
    });

    console.log('Image moderation:', imageModeration.results[0]?.flagged);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`Moderation error: ${error.message}`);
    }
    throw error;
  }
}

moderateContent();
```

## Error Handling

Comprehensive error handling with typed exceptions.

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function handleErrors() {
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello!' }],
    });
    console.log(completion.choices[0]?.message?.content);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`API Error: ${error.status}`);
      console.error(`Request ID: ${error.request_id}`);
      console.error(`Message: ${error.message}`);
      console.error(`Code: ${error.code}`);
      console.error(`Type: ${error.type}`);

      // Handle specific error types
      if (error instanceof OpenAI.RateLimitError) {
        console.error('Rate limit exceeded');
        const retryAfter = error.headers?.['retry-after'];
        console.log(`Retry after: ${retryAfter} seconds`);
        await new Promise(resolve => setTimeout(resolve, Number(retryAfter) * 1000));
      } else if (error instanceof OpenAI.AuthenticationError) {
        console.error('Invalid API key');
      } else if (error instanceof OpenAI.PermissionDeniedError) {
        console.error('Insufficient permissions');
      } else if (error instanceof OpenAI.NotFoundError) {
        console.error('Resource not found');
      } else if (error instanceof OpenAI.UnprocessableEntityError) {
        console.error('Invalid request parameters');
      } else if (error instanceof OpenAI.BadRequestError) {
        console.error('Bad request');
      } else if (error instanceof OpenAI.ConflictError) {
        console.error('Conflict error');
      } else if (error instanceof OpenAI.InternalServerError) {
        console.error('OpenAI server error');
      }
    } else if (error instanceof OpenAI.APIConnectionError) {
      console.error('Connection error:', error.message);
      console.error('Check your network connection');
    } else if (error instanceof OpenAI.APIConnectionTimeoutError) {
      console.error('Request timeout');
    } else if (error instanceof OpenAI.APIUserAbortError) {
      console.error('Request aborted by user');
    } else {
      throw error; // Re-throw unexpected errors
    }
  }
}

handleErrors();
```

## Advanced Configuration

Configure timeouts, retries, proxies, and custom fetch options.

```typescript
import OpenAI from 'openai';
import * as undici from 'undici';

// Configure timeouts and retries
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30 * 1000, // 30 seconds
  maxRetries: 3,
  defaultHeaders: {
    'X-Custom-Header': 'custom-value',
  },
  defaultQuery: {
    'custom_param': 'value',
  },
});

// Configure proxy (Node.js)
const proxyAgent = new undici.ProxyAgent('http://proxy.example.com:8080');
const proxiedClient = new OpenAI({
  fetchOptions: {
    dispatcher: proxyAgent,
  },
});

// Custom fetch function
const customClient = new OpenAI({
  fetch: async (url, init) => {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url, init);
    console.log(`Status: ${response.status}`);
    return response;
  },
});

// Per-request overrides
async function perRequestConfig() {
  const completion = await client.chat.completions.create(
    {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    },
    {
      timeout: 60 * 1000, // Override timeout for this request
      maxRetries: 5, // Override retry count
      headers: {
        'X-Request-ID': 'custom-id',
      },
      query: {
        'custom_param': 'value',
      },
    }
  );

  console.log(completion.choices[0]?.message?.content);
}

// Enable logging
const debugClient = new OpenAI({
  logLevel: 'debug', // 'debug' | 'info' | 'warn' | 'error' | 'off'
});

perRequestConfig();
```

## Summary

The OpenAI Node.js library is a production-ready SDK that simplifies integration with OpenAI's API platform. It provides type-safe interfaces for all major features including chat completions, embeddings, image generation, audio transcription/synthesis, file management, fine-tuning, vector stores, and real-time communication. The library handles common concerns like authentication, retries, timeouts, pagination, and error handling automatically while remaining flexible enough for advanced use cases through configuration options and custom middleware.

Primary use cases include building AI-powered chatbots with streaming responses and function calling, implementing semantic search with embeddings and vector stores, generating and editing images with DALL-E, transcribing audio and converting text to speech, fine-tuning custom models on domain-specific data, and creating low-latency voice interfaces with the Realtime API. The SDK integrates seamlessly with validation libraries like Zod for structured outputs, supports both CommonJS and ES modules, works across multiple JavaScript runtimes, and provides comprehensive TypeScript types for an excellent developer experience. Whether building simple chat interfaces or complex multi-modal AI applications, this library offers the tools and abstractions needed for robust OpenAI API integration.




