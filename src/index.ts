import { Ai } from '@cloudflare/ai'
import OpenAI from 'openai';
import cheerio from 'cheerio';

export interface Env {
	// If you set another name in wrangler.toml as the value for 'binding',
	// replace "AI" with the variable name you defined.
	AI: any;
	OPENAI_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env) {
		try {
			const body = JSON.parse(await request.text());
			const { prompt, messages } = body;
			const openai = new OpenAI({
				apiKey: env.OPENAI_API_KEY
			});

			//cleaned messages
			const cleanedMessages = messages.map((message: any) => {
				return { content: message.content || "MISSING MESSAGE", role: message.role || "assistant" };
			});
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
					}
				]
			});

			const completionChoice = chatCompletion.choices[0];
			const msg = completionChoice.message;

			if (!msg) {
				throw new Error("No message returned from OpenAI");
			}

			if (msg.function_call && msg.function_call.name === "read_website_content") {
				console.log("REQUESTING WEBSITE CONTENT")
				let websiteContent;
				const url = JSON.parse(msg.function_call.arguments).url;
				websiteContent = await read_website_content(url);
				console.log("WEBSITE CONTENT", websiteContent)
				const secondChatCompletion = await openai.chat.completions.create({
					model: "gpt-4-1106-preview",
					messages: [
						...cleanedMessages,
						{
							role: "function",
							name: msg.function_call.name,
							content: websiteContent
						}
					],
				});

				const secondCompletionChoice = secondChatCompletion.choices[0];
				const secondMSG = secondCompletionChoice.message;
				const secondOutput = secondMSG.content;
				return new Response(JSON.stringify(secondOutput));
			}

			const output = msg.content;
			console.log({ output });
			return new Response(JSON.stringify(output));
		} catch (error) {
			// Catch and return the error
			console.log(error.message);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	},
};

async function read_website_content(url) {
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

