import { handleRequest } from "./routes.js";

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};
