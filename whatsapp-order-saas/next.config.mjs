/** @type {import('next').NextConfig} */
const nextConfig = {
	async redirects() {
		return [
			{
				source: '/store/:slug',
				destination: '/order/:slug',
				permanent: true,
			},
		];
	},
};

export default nextConfig;
