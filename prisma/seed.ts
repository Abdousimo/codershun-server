import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const currencies = await Promise.all([
    prisma.currencies.upsert({
      where: { code: "EUR" },
      update: { name: "Euro", symbol: "€", isClientCurrency: true },
      create: {
        code: "EUR",
        name: "Euro",
        symbol: "€",
        isClientCurrency: true,
      },
    }),
    prisma.currencies.upsert({
      where: { code: "USD" },
      update: { name: "US Dollar", symbol: "$", isClientCurrency: true },
      create: {
        code: "USD",
        name: "US Dollar",
        symbol: "$",
        isClientCurrency: true,
      },
    }),
    prisma.currencies.upsert({
      where: { code: "GBP" },
      update: { name: "Pound Sterling", symbol: "£", isClientCurrency: true },
      create: {
        code: "GBP",
        name: "Pound Sterling",
        symbol: "£",
        isClientCurrency: true,
      },
    }),
  ]);

  const users = await Promise.all([
    prisma.users.upsert({
      where: { email: "alice@prisma.io" },
      update: { firstName: "Alice" },
      create: {
        email: "alice@prisma.io",
        role: "talent",
        firstName: "Alice",
      },
    }),
    prisma.users.upsert({
      where: { email: "bob@prisma.io" },
      update: { firstName: "Bob" },
      create: {
        email: "bob@prisma.io",
        role: "client_admin",
        firstName: "Bob",
      },
    }),
  ]);

  console.log(`Seeded ${currencies.length} currencies and ${users.length} users.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
