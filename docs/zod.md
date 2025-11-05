# Zod: TypeScript-First Schema Validation Library

Zod is a zero-dependency TypeScript validation library that enables developers to declare schemas and validate data with full static type inference. The library validates untrusted data at runtime while providing compile-time type safety, eliminating the need to maintain separate type definitions and runtime validators.

## Basic Schema Creation and Parsing

```typescript
import * as z from "zod";

// Define a schema
const User = z.object({
  username: z.string(),
  xp: z.number(),
  email: z.string().email(),
});

// Parse valid data (throws on error)
const validUser = User.parse({
  username: "billie",
  xp: 100,
  email: "billie@example.com"
});

// Safe parsing (returns result object)
const result = User.safeParse({
  username: 42,
  xp: "100"
});

if (!result.success) {
  console.error(result.error.issues);
} else {
  console.log(result.data);
}
```

## Type Inference

```typescript
const Player = z.object({
  username: z.string(),
  xp: z.number(),
  inventory: z.array(z.string()),
});

// Extract the inferred type
type Player = z.infer<typeof Player>;
// type Player = { username: string; xp: number; inventory: string[] }
```

## String Validation

```typescript
// Email validation
const emailSchema = z.email();
emailSchema.parse("user@example.com"); // ✓

// URL validation
const urlSchema = z.url();
urlSchema.parse("https://example.com"); // ✓

// UUID validation
const uuid4 = z.uuid();
uuid4.parse("550e8400-e29b-41d4-a716-446655440000"); // ✓

// String length constraints
const minFive = z.string().min(5);
const maxFive = z.string().max(5);
const exactFive = z.string().length(5);

// Pattern matching
const includes = z.string().includes("includes");
const startsWith = z.string().startsWith("startsWith");
const endsWith = z.string().endsWith("endsWith");
```

## Object Schema Validation

```typescript
const Test = z.object({
  f1: z.number(),
  f2: z.string().optional(),
  f3: z.string().nullable(),
  f4: z.array(z.object({ t: z.union([z.string(), z.boolean()]) })),
});

// Access shape of object schema
const f1Schema = Test.shape.f1; // ZodNumber
const f2Schema = Test.shape.f2; // ZodOptional<ZodString>

// Unknown keys are stripped by default
const schema = z.object({ points: z.number() });
schema.parse({ points: 2314, unknown: "asdf" });
// => { points: 2314 }

// Control unknown key behavior
const strict = z.object({ points: z.number() }).strict();
const passthrough = z.object({ points: z.number() }).passthrough();
```

## Refinements and Custom Validation

```typescript
// Basic refinement
const schema = z.object({
  first: z.string(),
  second: z.string(),
})
.partial()
.strict()
.refine(
  (data) => data.first || data.second,
  "Either first or second should be filled in."
);

// Password confirmation validation
const validationSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  confirmPassword: z.string(),
})
.refine(
  (data) => data.password === data.confirmPassword,
  "Both password and confirmation must match"
);
```

## Union Types and Discriminated Unions

```typescript
// Basic union
const stringOrNumber = z.union([z.string(), z.number()]);
// or use .or() shorthand
const stringOrNumber2 = z.string().or(z.number());

// Discriminated union for better performance
const ApiResponse = z.discriminatedUnion("type", [
  z.object({ type: z.literal("success"), data: z.string() }),
  z.object({ type: z.literal("error"), error: z.string() }),
]);
```

## Transformations

```typescript
// Basic transformation
const stringToLength = z.string().transform((val) => val.length);
const result = stringToLength.parse("hello"); // => 5 (number)

// Chained transformations with pipe
const pipeline = z.string()
  .transform((val) => val.trim())
  .pipe(z.string().min(1))
  .transform((val) => val.toUpperCase());
```

## Array and Tuple Validation

```typescript
// Array of strings
const stringArray = z.array(z.string());

// Array with length constraints
const minThreeStrings = z.array(z.string()).min(3);
const maxFiveStrings = z.array(z.string()).max(5);
const exactThreeStrings = z.array(z.string()).length(3);

// Fixed-length tuple with specific types
const tuple = z.tuple([z.string(), z.number(), z.boolean()]);
tuple.parse(["hello", 42, true]); // ✓
```

## Optional, Nullable, and Default Values

```typescript
// Optional (allows undefined)
const optionalString = z.string().optional();

// Nullable (allows null)
const nullableString = z.string().nullable();

// Nullish (allows both null and undefined)
const nullishString = z.string().nullish();

// Default value (applied when undefined)
const withDefault = z.string().default("default value");

// Catch (fallback on validation failure)
const withCatch = z.number().catch(0);
```

## Enum Validation

```typescript
// Zod enum (recommended)
const FishEnum = z.enum(["Salmon", "Tuna", "Trout"]);
type Fish = z.infer<typeof FishEnum>; // "Salmon" | "Tuna" | "Trout"

// Native TypeScript enum
enum NativeFruits {
  Apple = "apple",
  Banana = "banana",
}
const NativeFruitSchema = z.nativeEnum(NativeFruits);
```

## Type Coercion

```typescript
// Coerce string to number
const coercedNumber = z.coerce.number();
coercedNumber.parse("123");   // => 123 (number)

// Coerce to boolean
const coercedBoolean = z.coerce.boolean();
coercedBoolean.parse("true");  // => true

// Coerce to date
const coercedDate = z.coerce.date();
coercedDate.parse("2024-01-15"); // => Date object
```

## Error Handling

```typescript
try {
  schema.parse({ username: 42, age: 15 });
} catch (err) {
  if (err instanceof z.ZodError) {
    // Raw issues array
    console.log(err.issues);
    
    // Flattened errors
    const flattened = z.flattenError(err);
    
    // Pretty-printed errors
    const pretty = z.prettifyError(err);
  }
}
```

## Summary

Zod serves as a comprehensive solution for runtime data validation in TypeScript applications, particularly excelling in scenarios involving API request/response validation, form data processing, configuration file parsing, file upload validation, and database model validation. The library's type inference capabilities eliminate redundant type definitions, while its chainable API enables developers to build complex validation rules incrementally.

Common use cases include validating user input from web forms, parsing environment variables with type safety, validating JSON API responses, enforcing database schema constraints, validating file uploads with size and type restrictions, and validating WebSocket messages in real-time applications.


