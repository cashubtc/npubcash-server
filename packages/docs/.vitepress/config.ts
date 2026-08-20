import { defineConfig } from "vitepress";

export default defineConfig({
  title: "npubcash Documentation",
  description: "Documentation for the npubcash API and SDK",

  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Migration Day", link: "/docs/migration-day" },
      { text: "API", link: "/docs/api/endpoints" },
      { text: "SDK", link: "/docs/sdk/npubcash-sdk" },
      { text: "Deployment", link: "/docs/server/deployment" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Migration day", link: "/docs/migration-day" },
          { text: "Getting Started", link: "/docs/getting-started" },
          { text: "How does it work?", link: "/docs/how-does-it-work" },
          { text: "Production migration", link: "/docs/migration" },
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

    search: {
      provider: "local",
    },
  },
});
