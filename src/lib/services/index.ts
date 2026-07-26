export { AuthService } from "./auth.service";
export { PostsService } from "./posts.service";

// ponytail: lazy singletons only — no eager creation, avoids Turbopack TDZ from circular deps
import { AuthService } from "./auth.service";
import { PostsService } from "./posts.service";

let _authService: AuthService | null = null;
let _postsService: PostsService | null = null;

export function authService(): AuthService {
  if (!_authService) _authService = new AuthService();
  return _authService;
}

export function postsService(): PostsService {
  if (!_postsService) _postsService = new PostsService();
  return _postsService;
}