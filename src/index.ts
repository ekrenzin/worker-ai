import { Ai } from '@cloudflare/ai'
import { handleGet } from './get';
import { handlePost } from './post';

export interface Env {
	// If you set another name in wrangler.toml as the value for 'binding',
	// replace "AI" with the variable name you defined.
	AI: Ai;
	OPENAI_API_KEY: string;
	WORKER_BUCKET: any;
	DB: any;
}

interface message {
	content: string;
	role: string;
}

/**
 * Main function to handle requests
 * @param {Request} request - The incoming HTTP request.
 * @param {Env} env - The environment variables.
 * @returns {Promise<Response>} - The response to be sent back.
 */

export default {

	async fetch(request: Request, env: Env) {

		switch (request.method) {
			case 'POST':
				return await handlePost(request, env);
			case 'GET':
				return await handleGet(request, env);
			default:
				return new Response('Method not allowed', { status: 405 });
		}
	}
}
