/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@velvet-rope/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" }
    ]
  }
};

export default nextConfig;
