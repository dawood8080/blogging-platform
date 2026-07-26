// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UsersRepository } from "@/lib/repositories/users.repository";

function mockChain(resolveValue: unknown) {
  const self: Record<string, unknown> = {};
  for (const m of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit", "offset", "values", "set", "returning"]) {
    self[m] = vi.fn(() => self);
  }
  self.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);
  return self;
}

const mockSelect = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/db", () => ({
  db: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
  })),
}));

const fakeUser = {
  id: "u1",
  email: "test@test.com",
  name: "Test",
  passwordHash: "hash",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

describe("UsersRepository", () => {
  let repo: UsersRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new UsersRepository();
  });

  it("findByEmail returns null when not found", async () => {
    mockSelect.mockReturnValueOnce(mockChain([]));
    const result = await repo.findByEmail("nope@test.com");
    expect(result).toBeNull();
  });

  it("findByEmail returns user when found", async () => {
    mockSelect.mockReturnValueOnce(mockChain([fakeUser]));
    const result = await repo.findByEmail("test@test.com");
    expect(result).toEqual(fakeUser);
  });

  it("findById returns null when not found", async () => {
    mockSelect.mockReturnValueOnce(mockChain([]));
    const result = await repo.findById("nonexistent");
    expect(result).toBeNull();
  });

  it("findById returns user when found", async () => {
    mockSelect.mockReturnValueOnce(mockChain([fakeUser]));
    const result = await repo.findById("u1");
    expect(result).toEqual(fakeUser);
  });

  it("create inserts and returns the user", async () => {
    mockInsert.mockReturnValueOnce(mockChain([fakeUser]));
    const result = await repo.create({ email: "test@test.com", name: "Test", passwordHash: "hash" });
    expect(result).toEqual(fakeUser);
  });
});
