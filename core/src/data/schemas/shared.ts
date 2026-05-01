import { z } from "zod";

export const idSchema = z.string();
export const nameSchema = z.string();
export const descriptionSchema = z.string();
export const stringNumberRecordSchema = z.record(z.string(), z.number());
