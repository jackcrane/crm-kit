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
        text: "Blocks",
        items: [
          {
            text: "User Access",
            items: [
              {
                text: "Login",
                link: "/blocks/login",
              },
            ],
          },
        ],
      },
    ],
  },
});
