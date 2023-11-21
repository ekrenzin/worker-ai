export async function handleGet(request: Request, env: Env) {
	//get the image key from the request
	const url = new URL(request.url);
	const key = url.searchParams.get("key");
	if (!key) {
		return new Response(JSON.stringify({ error: "No key provided" }), { status: 400 });
	}
	//get the image from R2
	const bucket = env.WORKER_BUCKET;
	const imageResponse = await bucket.get(key);
	const image = imageResponse.body;
	if (!image) {
		return new Response(JSON.stringify({ error: "No image found" }), { status: 404 });
	}
	//return the image

	return new Response(image, {
		headers: {
			'content-type': 'image/png',
			'cache-control': 'public, max-age=31536000',
		},
	});
}
