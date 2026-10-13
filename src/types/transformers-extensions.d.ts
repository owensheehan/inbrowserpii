import '@huggingface/transformers'

// Augment @huggingface/transformers to expose Florence-2 models supported in v3+ runtime
declare module '@huggingface/transformers' {
  export interface Florence2ModelOptions {
    device?: string
    dtype?: string | Record<string, string>
    progress_callback?: (data: unknown) => void
  }

  export class Florence2ForConditionalGeneration {
    static from_pretrained(
      pretrained_model_name_or_path: string,
      options?: Florence2ModelOptions,
    ): Promise<Florence2ForConditionalGeneration>

    generate(options: Record<string, unknown>): Promise<unknown>
  }

  export interface Florence2ProcessorInstance {
    (images: unknown, text?: unknown, kwargs?: Record<string, unknown>): Promise<Record<string, unknown>>
    construct_prompts(text: string | string[]): string[]
    batch_decode(tokens: unknown, options?: Record<string, unknown>): string[]
    post_process_generation(
      text: string,
      task: string,
      image_size: [number, number],
    ): Record<string, unknown>
  }

  export class Florence2Processor {
    static from_pretrained(
      pretrained_model_name_or_path: string,
      options?: Record<string, unknown>,
    ): Promise<Florence2ProcessorInstance>
  }
}
