import { Ai } from '@cloudflare/ai'
import OpenAI from 'openai';
import type { OpenAI as OpenAIType } from 'openai'
import cheerio from 'cheerio';

export interface Env {
	// If you set another name in wrangler.toml as the value for 'binding',
	// replace "AI" with the variable name you defined.
	AI: any;
	OPENAI_API_KEY: string;
}

interface message {
	content: string;
	role: string;
}

/**
 * Environment variables and types
 */
export interface Env {
	AI: any;
	OPENAI_API_KEY: string;
}

/**
 * Main function to handle requests
 * @param {Request} request - The incoming HTTP request.
 * @param {Env} env - The environment variables.
 * @returns {Promise<Response>} - The response to be sent back.
 */

export default {

	async fetch(request: Request, env: Env) {
		try {
			const requestBody = JSON.parse(await request.text());
			const { messages } = requestBody;
			const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

			// Clean and process messages
			const cleanedMessages = cleanMessages(messages);
			const chatResponse = await generateChatResponse(openai, cleanedMessages);

			const msg = chatResponse.message;

			if (!msg) {
				throw new Error("No message returned from OpenAI");
			}
			if (msg.function_call && msg.function_call.name) {
				if (msg.function_call.name === "read_website_content") {
					try {
						const url = JSON.parse(msg.function_call.arguments).url;
						const websiteContent = await readWebsiteContent(url);
						return await generateWebsiteResponse(openai, cleanedMessages, msg.function_call.name, websiteContent);
					} catch (error) {
						console.error('error reading website content', error.message);
						return new Response(JSON.stringify({ error: error.message }), { status: 500 });
					}
				} else if (msg.function_call.name === "generate_image") {
					try {
						const prompt = JSON.parse(msg.function_call.arguments).prompt;
						const imageUrl = await generateImage(openai, prompt);

						//append the image to the chat response
						chatResponse.message.content = "Here is your image:\n\n" + 
                                `<p style="display: block; margin-bottom: 0.75rem"><img src=${imageUrl} alt="prompt generated image" /></p>` + 
                                "\n\n" + (chatResponse.message.content || "");
					} catch (error) {
						console.error('error generating image', error.message);
						return new Response(JSON.stringify({ error: error.message }), { status: 500 });
					}
				}
			}

			return new Response(JSON.stringify(chatResponse.message.content));
		} catch (error) {
			console.error(error.message);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	}
}


/**
 * Clean messages from the request body.
 * @param {Array} messages - Array of message objects.
 * @returns {Array} - Array of cleaned message objects.
 */
function cleanMessages(messages: Array<message>) {
	return messages.map(message => ({
		content: message.content || "MISSING MESSAGE",
		role: message.role || "assistant"
	}));
}

/**
 * Generate a chat response using OpenAI.
 * @param {OpenAI} openai - OpenAI instance.
 * @param {Array} cleanedMessages - Array of cleaned message objects.
 * @returns {Promise<Object>} - The chat completion response.
 */
async function generateChatResponse(openai: OpenAIType, cleanedMessages) {
	const chatCompletion = await openai.chat.completions.create({
		messages: cleanedMessages,
		model: 'gpt-4-1106-preview',
		functions: [
			{
				name: "read_website_content",
				description: "Read the content on a given website",
				parameters: {
					type: "object",
					properties: {
						url: {
							type: "string",
							description: "The URL to the website to read ",
						}
					},
					required: ["url"],
				},
			},
			{
				name: "generate_image",
				description: "Generate an image based on a prompt",
				parameters: {
					type: "object",
					properties: {
						prompt: {
							type: "string",
							description: "The prompt to generate an image from"
						},
						size: {
							type: "string",
							description: "The size of the image, default is '512x512'",
							default: "512x512"
						}
					},
					required: ["prompt"],
				},
			}
		]
	});
	return chatCompletion.choices[0];
}


/**
 * Generate a second chat response based on website content.
 * @param {OpenAI} openai - OpenAI instance.
 * @param {Array} cleanedMessages - Array of cleaned message objects.
 * @param {string} functionName - Name of the function called.
 * @param {string} websiteContent - Content from the website.
 * @returns {Promise<Response>} - The response to be sent back.
 */
async function generateWebsiteResponse(openai: OpenAIType, cleanedMessages: Array<message>, functionName: string, websiteContent: string) {
	const functionMessage: any = {
		role: "function",
		name: functionName,
		content: websiteContent
	}
	const webCompletion = await openai.chat.completions.create({
		model: "gpt-4-1106-preview",
		messages: [
			...cleanedMessages,
			functionMessage
		],
		functions: []
	});
	const websiteCompletionChoice = webCompletion.choices[0];
	return new Response(JSON.stringify(websiteCompletionChoice.message.content));
}


/**
 * Generates an image based on a given prompt using OpenAI's image generation API.
 * @param {OpenAI} openai - The OpenAI instance.
 * @param {string} prompt - The prompt to generate an image from.
 * @param {string} size - The size of the image. Default is '512x512'.
 * @returns {Promise<string>} - The URL of the generated image.
 */
async function generateImage(openai: OpenAIType, prompt) {
	try {
		const response = await openai.images.generate({
			model: 'dall-e-3',
			prompt,
			n: 1
		});
		const image = response.data[0];
		if (!image) {
			throw new Error('Image not found in the response.');
		}
		console.log("image", image);
		const imageUrl = image.url;
		if (!imageUrl) {
			throw new Error('Image URL not found in the response.');
		}
		return imageUrl;
	} catch (error) {
		console.error('Error generating image:', error.message);
		throw error;
	}
}

/**
 * Reads website content and returns as JSON.
 * @param {string} url - URL of the website to read.
 * @returns {Promise<string>} - JSON string of the website content.
 */
async function readWebsiteContent(url: string) {
	console.log("reading website content", url);

	const response = await fetch(url);
	const body = await response.text();
	let cheerioBody = await cheerio.load(body);
	const paragraphs = cheerioBody("p");
	const spans = cheerioBody("span");
	const headers = cheerioBody("h1, h2, h3, h4, h5, h6");
	const links = cheerioBody("a");
	const images = cheerioBody("img");
	const lists = cheerioBody("ul, ol");
	const tables = cheerioBody("table");
	const forms = cheerioBody("form");
	const scripts = cheerioBody("script");
	const styles = cheerioBody("style");
	const meta = cheerioBody("meta");
	const title = cheerioBody("title");
	const head = cheerioBody("head");

	//add these to a single text string
	const text = paragraphs.text() + spans.text() + headers.text() + links.text() + images.text() + lists.text() + tables.text() + forms.text() + scripts.text() + styles.text() + meta.text() + title.text() + head.text();
	const resp = {
		website_body: text,
		url: url
	}
	return JSON.stringify(resp);
}

