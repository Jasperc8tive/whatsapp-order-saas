/** @type {import('next').NextConfig} */
const nextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.supabase.co",
				pathname: "/storage/v1/object/public/**",
			},
		],
	},
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
