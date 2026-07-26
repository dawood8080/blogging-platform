import { UsersRepository, type IUsersRepository } from "./users.repository";
import { PostsRepository, type IPostsRepository } from "./posts.repository";

export { type IUsersRepository, type IPostsRepository, UsersRepository, PostsRepository };

// lazy singletons only — no eager creation, avoids Turbopack TDZ from circular deps
let _usersRepo: IUsersRepository | null = null;
let _postsRepo: IPostsRepository | null = null;

export function usersRepo(): IUsersRepository {
  if (!_usersRepo) _usersRepo = new UsersRepository();
  return _usersRepo;
}

export function postsRepo(): IPostsRepository {
  if (!_postsRepo) _postsRepo = new PostsRepository();
  return _postsRepo;
}
