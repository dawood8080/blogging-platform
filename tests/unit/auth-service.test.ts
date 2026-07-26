// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import { AuthService } from "@/lib/services/auth.service";
import type { IUsersRepository } from "@/lib/repositories/users.repository";

function makeMockRepo(): IUsersRepository {
  return {
    findByEmail: vi.fn() as Mock,
    findById: vi.fn() as Mock,
    create: vi.fn() as Mock,
  };
}

describe("AuthService", () => {
  it("register throws EMAIL_TAKEN if email exists", async () => {
    const repo = makeMockRepo();
    (repo.findByEmail as Mock).mockResolvedValue({ id: "1" });
    const service = new AuthService(repo);

    await expect(
      service.register({
        email: "test@test.com",
        name: "Test",
        password: "password123",
      })
    ).rejects.toThrow("EMAIL_TAKEN");
  });

  it("register creates user and returns token", async () => {
    const repo = makeMockRepo();
    (repo.findByEmail as Mock).mockResolvedValue(null);
    (repo.create as Mock).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      passwordHash: "hash",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new AuthService(repo);

    const result = await service.register({
      email: "test@test.com",
      name: "Test",
      password: "password123",
    });

    expect(result.user.id).toBe("user-1");
    expect(result.token).toBeTruthy();
  });

  it("login throws INVALID_CREDENTIALS for unknown email", async () => {
    const repo = makeMockRepo();
    (repo.findByEmail as Mock).mockResolvedValue(null);
    const service = new AuthService(repo);

    await expect(
      service.login({ email: "test@test.com", password: "password123" })
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("login throws INVALID_CREDENTIALS for wrong password", async () => {
    const repo = makeMockRepo();
    (repo.findByEmail as Mock).mockResolvedValue({
      id: "1",
      email: "test@test.com",
      name: "Test",
      passwordHash: "$2a$12$invalidhash",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new AuthService(repo);

    await expect(
      service.login({ email: "test@test.com", password: "wrongpassword" })
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("getMe returns null for unknown user", async () => {
    const repo = makeMockRepo();
    (repo.findById as Mock).mockResolvedValue(null);
    const service = new AuthService(repo);

    const result = await service.getMe("unknown-id");
    expect(result).toBeNull();
  });

  it("getMe returns user for known user", async () => {
    const repo = makeMockRepo();
    (repo.findById as Mock).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      passwordHash: "hash",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new AuthService(repo);

    const result = await service.getMe("user-1");
    expect(result).toEqual({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
    });
  });
});