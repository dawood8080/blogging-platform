 import { usersRepo, type IUsersRepository } from "@/lib/repositories";
import {
  hashPassword,
  verifyPassword,
  signToken,
  type SessionUser,
} from "@/lib/auth";
import type { RegisterInput, LoginInput } from "@/lib/schemas";

export class AuthService {
  constructor(private users: IUsersRepository = usersRepo()) {}

  async register(input: RegisterInput): Promise<{
    user: SessionUser;
    token: string;
  }> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new Error("EMAIL_TAKEN");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
    };
    const token = await signToken(sessionUser);

    return { user: sessionUser, token };
  }

  async login(
    input: LoginInput
  ): Promise<{ user: SessionUser; token: string }> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
    };
    const token = await signToken(sessionUser);

    return { user: sessionUser, token };
  }

  async getMe(userId: string): Promise<SessionUser | null> {
    const user = await this.users.findById(userId);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name };
  }
}