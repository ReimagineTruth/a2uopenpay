declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: (
    supabaseUrl: string,
    supabaseKey: string,
  ) => any;
}

declare module "https://esm.sh/stellar-sdk@11.3.0" {
  const mod: any;
  export default mod;
  export const Keypair: any;
  export const Horizon: any;
  export const Operation: any;
  export const Asset: any;
  export const Memo: any;
  export const TransactionBuilder: any;
  export const Networks: any;
}

// Minimal Deno global typings for local type-checking of Edge Functions
declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};
