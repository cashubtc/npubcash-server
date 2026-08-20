import { defineConfig } from "vitepress";

export default defineConfig({
  title: "npubcash",
  description: "Lightning Addresses for Nostr, powered by Cashu",
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: "Guide", link: "/docs/getting-started" },
      { text: "API", link: "/docs/api/endpoints" },
      { text: "SDK", link: "/docs/sdk/npubcash-sdk" },
      { text: "Deployment", link: "/docs/server/deployment" },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/docs/getting-started" },
          { text: "How it works", link: "/docs/how-does-it-work" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "Endpoints", link: "/docs/api/endpoints" },
          { text: "Authentication", link: "/docs/api/authentication" },
          { text: "Error Handling", link: "/docs/api/error-handling" },
        ],
      },
      {
        text: "SDK",
        items: [{ text: "npubcash-sdk", link: "/docs/sdk/npubcash-sdk" }],
      },
      {
        text: "Server",
        items: [{ text: "Deployment", link: "/docs/server/deployment" }],
      },
    ],

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/cashubtc/npubcash-server",
      },
    ],

    footer: {
      message: "Released under the MIT License.",
    },

    editLink: {
      pattern:
        "https://github.com/cashubtc/npubcash-server/edit/main/packages/docs/:path",
      text: "Edit this page on GitHub",
    },

    search: {
      provider: "local",
    },

    outline: [2, 3],
  },
});
