import { VelvetApiClient } from "@velvet-rope/shared";

export const api = new VelvetApiClient(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api");
