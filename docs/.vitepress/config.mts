import { defineConfig } from "vitepress";
import { tabsMarkdownPlugin } from "vitepress-plugin-tabs";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "CRM Kit User Guide",
  description: "A user guide for building powerful CRMs with CRM Kit",
  markdown: {
    config(md) {
      md.use(tabsMarkdownPlugin);
    },
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      {
        text: "Blocks",
        link: "/blocks",
      },
    ],

    sidebar: [
      {
        text: "Basics",
        items: [
          {
            text: "API Requests",
            link: "/requests",
          },
        ],
      },
      {
        text: "User Access",
        items: [
          {
            text: "Login",
            link: "/blocks/access/login",
          },
          {
            text: "New Accounts",
            items: [
              {
                link: "/blocks/access/invitations",
                text: "Inviting users",
              },
              {
                link: "/blocks/access/invitations/accepting",
                text: "Accepting invitations",
              },
              {
                link: "/blocks/access/invitations/retrieving",
                text: "Retrieving invitations",
              },
              {
                link: "/blocks/access/invitations/rescinding",
                text: "Rescinding invitations",
              },
            ],
          },
          {
            text: "Entitlements",
            link: "/blocks/access/entitlements",
            items: [
              {
                text: "Listing all entitlements",
                link: "/blocks/access/entitlements/listing",
              },
              {
                text: "Retrieving a user's entitlements",
                link: "/blocks/access/entitlements/retrieving",
              },
              {
                text: "Modifying a user's entitlements",
                link: "/blocks/access/entitlements/modifying",
              },
            ],
          },
        ],
      },
    ],
  },
});
