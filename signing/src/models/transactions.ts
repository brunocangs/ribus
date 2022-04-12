export { Transaction } from "@prisma/client";
import { prisma } from "../lib/utils";

const transactions = prisma.transaction;

export default transactions;
