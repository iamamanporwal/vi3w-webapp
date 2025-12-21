import Replicate from 'replicate';

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

export async function generateTextToImage(prompt: string): Promise<string> {
    if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error('REPLICATE_API_TOKEN is not set');
    }

    try {
        // Using flux-schnell for fast, high-quality images
        const output = await replicate.run(
            "black-forest-labs/flux-schnell",
            {
                input: {
                    prompt: prompt,
                    go_fast: true,
                    megapixels: "1",
                    num_outputs: 1,
                    aspect_ratio: "1:1",
                    output_format: "webp",
                    output_quality: 80
                }
            }
        );

        if (Array.isArray(output) && output.length > 0) {
            // Replicate returns a ReadableStream or URL depending on the model/version
            // For flux-schnell, it usually returns an array of output URLs/Streams
            const result = output[0];

            // If it's a stream (rare for simple image gen but possible), we might need handling
            // But typically for this model it's a URL or a file object that toString() works on
            return String(result);
        }

        throw new Error('No output from Replicate');
    } catch (error: any) {
        console.error('Replicate Text-to-Image Error:', error);
        throw new Error(`Failed to generate image: ${error.message}`);
    }
}

export async function convertFloorplanToIsometric(imageUrl: string): Promise<string> {
    if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error('REPLICATE_API_TOKEN is not set');
    }

    try {
        // Using ControlNet Canny for structure preservation
        // Model: jagilley/controlnet-canny
        const output = await replicate.run(
            "jagilley/controlnet-canny:aff48af9c68d162388d230a2ab003f68d2638d88307bdaf1c2f1ac95079c9669",
            {
                input: {
                    image: imageUrl,
                    prompt: "isometric 3d floorplan, high quality, photorealistic, architectural render, white background",
                    num_samples: 1,
                    image_resolution: 512,
                    ddim_steps: 20,
                    scale: 9,
                    eta: 0,
                    a_prompt: "best quality, extremely detailed",
                    n_prompt: "longbody, lowres, bad anatomy, bad hands, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality"
                }
            }
        );

        if (Array.isArray(output) && output.length > 0) {
            return String(output[1]); // output[1] is usually the generated image, output[0] is canny map
        }

        if (typeof output === 'string') return output;

        throw new Error('No output from Replicate ControlNet');
    } catch (error: any) {
        console.error('Replicate Floorplan-to-Isometric Error:', error);
        throw new Error(`Failed to convert floorplan: ${error.message}`);
    }
}

export async function generateTrellis3D(imageUrl: string, webhookUrl?: string): Promise<any> {
    if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error('REPLICATE_API_TOKEN is not set');
    }

    try {
        const options: any = {
            input: {
                image: imageUrl,
                ss_sampling_steps: 25,
                slat_sampling_steps: 12,
                mesh_simplify: 0.95,
                generate_model: true
            }
        };

        if (webhookUrl) {
            options.webhook = webhookUrl;
            options.webhook_events_filter = ["completed", "failed"];
        }

        const model = await replicate.models.get("firtoz", "trellis");
        const latestVersion = model.latest_version?.id;

        if (!latestVersion) {
            throw new Error("Could not find latest version of firtoz/trellis");
        }

        const prediction = await replicate.predictions.create({
            version: latestVersion,
            input: options.input,
            webhook: options.webhook,
            webhook_events_filter: options.webhook_events_filter
        });

        return prediction;
    } catch (error: any) {
        console.error('Replicate Trellis 3D Error:', error);
        throw new Error(`Failed to start Trellis generation: ${error.message}`);
    }
}
