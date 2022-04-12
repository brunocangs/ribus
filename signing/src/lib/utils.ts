import { PrismaClient } from "@prisma/client";
import { defaultPath } from "ethers/lib/utils";
export const getWalletPathAt = (index: number) =>
  defaultPath.slice(0, -1) + index;

export const prisma = new PrismaClient();
