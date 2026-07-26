import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

type User = typeof users.$inferSelect;
// ponytail: db is now a function call

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
}

export interface IUsersRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}

export class UsersRepository implements IUsersRepository {
  async findByEmail(email: string): Promise<User | null> {
    const result = await db()
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await db()
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const result = await db().insert(users).values(input).returning();
    return result[0];
  }
}
