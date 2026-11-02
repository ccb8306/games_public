import { z } from "zod";

const vector = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
const rotation = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
export const poseSchema = z.strictObject({ p: vector, q: rotation });
export const motionSchema = z.strictObject({
  id: z.uuid(),
  seq: z.number().int().nonnegative(),
  at: z.number().finite(),
  phase: z.enum(["shaking", "throwing", "rest"]),
  dice: z.array(poseSchema).min(4).max(10),
  cup: poseSchema.nullable(),
  wind: z.boolean(),
  windDirection: z.number().int().min(0).max(7).optional(),
  paused: z.boolean(),
});
export type Pose = z.infer<typeof poseSchema>;
export type MotionFrame = z.infer<typeof motionSchema>;
export const FACE_ORDER = [3, 4, 1, 6, 2, 5];
