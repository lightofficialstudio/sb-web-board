"use client";

import { useTheme } from "@/app/contexts/theme-context";
import { App, ConfigProvider, Flex, Layout } from "antd";
import thTH from "antd/locale/th_TH";
import dayjs from "dayjs";
import "dayjs/locale/th";
import buddhistEra from "dayjs/plugin/buddhistEra";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { buildCssVars, buildLandingTheme } from "./_config/landing-theme";
import Footer from "./footer";
import Navbar from "./navbar";

dayjs.extend(buddhistEra);
dayjs.locale("th");

// Client boundary — ใช้ theme context + inject ConfigProvider/CSS vars
export function LandingLayoutClient({ children }: { children: ReactNode }) {
  const { mode } = useTheme();
  const isDark = mode === "dark";

  const themeConfig = useMemo(() => buildLandingTheme(isDark), [isDark]);
  const cssVars = useMemo(() => buildCssVars(isDark), [isDark]);

  return (
    <ConfigProvider
      locale={{ ...thTH, Form: { ...thTH.Form, optional: "(ไม่บังคับ)" } }}
      theme={themeConfig}
      componentSize="middle"
      input={{ autoComplete: "off" }}
    >
      <App>
        <Flex
          vertical
          className="ant-theme-root"
          style={{ ...cssVars, minHeight: "100vh" }}
        >
          <Layout style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Navbar />
            <Layout.Content
              style={{
                flex: "1 0 auto",
                width: "100%",
                maxWidth: "100vw",
                paddingTop: 68, // offset for fixed Navbar
              }}
            >
              <Flex vertical style={{ width: "100%", height: "100%" }}>
                {children}
              </Flex>
            </Layout.Content>
            <Footer />
          </Layout>
        </Flex>
      </App>
    </ConfigProvider>
  );
}
