"use client";

// ✨ AI Blog Assistant Panel — ช่วยเขียน title, excerpt, content, tags, SEO
import {
  BulbOutlined,
  CopyOutlined,
  FileTextOutlined,
  LoadingOutlined,
  RobotOutlined,
  SearchOutlined,
  TagsOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Flex,
  Input,
  Progress,
  Select,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import { useState } from "react";
import { SeoScore, useAdminBlogStore } from "../_state/blog-store";

const { Text, Title } = Typography;
const { TextArea } = Input;

const CATEGORIES = [
  "การพัฒนาวิชาชีพ",
  "เทคนิคการสอน",
  "เทคโนโลยีการศึกษา",
  "ไลฟ์สไตล์ครู",
  "ข่าวการศึกษา",
  "ทั่วไป",
];

interface AiAssistantPanelProps {
  // ✨ callback เมื่อ AI generate ผลลัพธ์ที่ต้องการใส่ใน form
  onApplyTitle?: (title: string) => void;
  onApplyExcerpt?: (excerpt: string) => void;
  onApplyContent?: (content: string) => void;
  onApplyTags?: (tags: string[]) => void;
  // ✨ ค่าปัจจุบันใน form สำหรับ SEO analysis
  currentTitle?: string;
  currentContent?: string;
  currentCategory?: string;
}

// ✨ SEO Grade color
const gradeColor: Record<string, string> = {
  A: "#52c41a",
  B: "#1677ff",
  C: "#fa8c16",
  D: "#ff4d4f",
};

// ✨ SEO Score card
function SeoScoreCard({ score }: { score: SeoScore }) {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={10}>
      <Flex align="center" gap={12}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: `${gradeColor[score.grade]}20`,
            border: `3px solid ${gradeColor[score.grade]}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text strong style={{ fontSize: 20, color: gradeColor[score.grade] }}>
            {score.grade}
          </Text>
        </div>
        <Flex vertical gap={2}>
          <Text strong style={{ fontSize: 16 }}>
            {score.score}/100 คะแนน
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            อ่านง่าย: {score.readability} · Keyword density:{" "}
            {score.keyword_density}%
          </Text>
        </Flex>
      </Flex>
      <Progress
        percent={score.score}
        strokeColor={gradeColor[score.grade]}
        railColor={token.colorFillSecondary}
        showInfo={false}
        size="small"
      />
      {score.issues.length > 0 && (
        <Flex vertical gap={4}>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
            ⚠️ ปัญหาที่พบ
          </Text>
          {score.issues.map((issue, i) => (
            <Text key={i} type="secondary" style={{ fontSize: 12 }}>
              • {issue}
            </Text>
          ))}
        </Flex>
      )}
      {score.suggestions.length > 0 && (
        <Flex vertical gap={4}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: "#52c41a" }}>
            💡 คำแนะนำ
          </Text>
          {score.suggestions.map((s, i) => (
            <Text key={i} style={{ fontSize: 12, color: token.colorText }}>
              • {s}
            </Text>
          ))}
        </Flex>
      )}
    </Flex>
  );
}

export function AiAssistantPanel({
  onApplyTitle,
  onApplyExcerpt,
  onApplyContent,
  onApplyTags,
  currentTitle,
  currentContent,
  currentCategory,
}: AiAssistantPanelProps) {
  const { token } = theme.useToken();
  const { aiAssist, isAiLoading, aiSeoScore, showModal } = useAdminBlogStore();

  const [activeTab, setActiveTab] = useState<
    "title" | "excerpt" | "content" | "tags" | "seo"
  >("title");
  const [topic, setTopic] = useState("");
  const [outline, setOutline] = useState("");
  const [category, setCategory] = useState(currentCategory ?? "");
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [generatedExcerpt, setGeneratedExcerpt] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedTags, setGeneratedTags] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (activeTab === "title") {
      if (!topic.trim()) {
        showModal({
          type: "confirm",
          title: "กรุณาระบุหัวข้อก่อน",
          description:
            "กรอกคำหัวข้อบทความที่ต้องการให้ AI ช่วยสร้างชื่อบทความก่อน",
          confirmLabel: "ตกลง",
        });
        return;
      }
      const result = (await aiAssist({
        action: "generate_title",
        topic,
        category,
      })) as string[];
      if (Array.isArray(result)) setGeneratedTitles(result);
      else if ((result as { raw?: string })?.raw) {
        const lines = (result as { raw: string }).raw
          .split("\n")
          .filter((l: string) => l.trim().length > 2);
        setGeneratedTitles(lines.slice(0, 5));
      }
    } else if (activeTab === "excerpt") {
      if (!currentTitle) {
        showModal({
          type: "confirm",
          title: "กรุณาใส่ชื่อบทความในฟอร์มก่อน",
          description:
            "กรอกชื่อบทความในฟอร์มก่อน เพื่อให้ AI สร้างสรุปย่อได้ตรงเป้าหมายมากขึ้น",
          confirmLabel: "ตกลง",
        });
        return;
      }
      const result = (await aiAssist({
        action: "generate_excerpt",
        title: currentTitle,
        content: currentContent,
        category,
      })) as { excerpt?: string };
      if (result?.excerpt) setGeneratedExcerpt(result.excerpt);
    } else if (activeTab === "content") {
      if (!currentTitle && !topic) {
        showModal({
          type: "confirm",
          title: "กรุณาระบุหัวข้อหรือชื่อบทความก่อน",
          description:
            'กรอกชื่อบทความในฟอร์ม หรือระบุหัวข้อในช่อง "ระบุหัวข้อที่ต้องการ" บนแผงนี้ เพื่อให้ AI เขียนเนื้อหาได้ประสิทธิภาพมากกว่า',
          confirmLabel: "ตกลง",
        });
        return;
      }
      const result = (await aiAssist({
        action: "generate_content",
        title: currentTitle ?? topic,
        outline,
        category,
      })) as { content?: string };
      if (result?.content) setGeneratedContent(result.content);
    } else if (activeTab === "tags") {
      if (!currentTitle) {
        showModal({
          type: "confirm",
          title: "กรุณาใส่ชื่อบทความก่อน",
          description:
            "กรอกชื่อบทความในฟอร์มก่อน เพื่อให้ AI แนะนำ tags ที่เหมาะสมกับเนื้อหาได้ถูกต้องมากขึ้น",
          confirmLabel: "ตกลง",
        });
        return;
      }
      const result = (await aiAssist({
        action: "suggest_tags",
        title: currentTitle,
        content: currentContent,
        category,
      })) as { tags?: string[] };
      if (result?.tags) setGeneratedTags(result.tags);
    } else if (activeTab === "seo") {
      if (!currentTitle) {
        showModal({
          type: "confirm",
          title: "กรุณาใส่ชื่อบทความก่อน",
          description:
            "ความแม่นยำของชื่อบทความจะช่วยให้ผลวิเคราะห์ SEO แม่นยำมากขึ้น",
          confirmLabel: "ตกลง",
        });
        return;
      }
      await aiAssist({
        action: "seo_score",
        title: currentTitle,
        content: currentContent,
        category,
      });
    }
  };

  const tabs: {
    key: typeof activeTab;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: "title", label: "ชื่อบทความ", icon: <FileTextOutlined /> },
    { key: "excerpt", label: "สรุปย่อ", icon: <BulbOutlined /> },
    { key: "content", label: "เนื้อหา", icon: <ThunderboltOutlined /> },
    { key: "tags", label: "Tags", icon: <TagsOutlined /> },
    { key: "seo", label: "SEO", icon: <SearchOutlined /> },
  ];

  return (
    <Card
      style={{
        background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorInfoBg} 100%)`,
        border: `1px solid ${token.colorPrimaryBorder}`,
        borderRadius: 16,
      }}
      styles={{ body: { padding: "16px 20px" } }}
    >
      {/* ✨ Header */}
      <Flex align="center" gap={10} style={{ marginBottom: 16 }}>
        <Flex
          align="center"
          justify="center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${token.colorPrimary} 0%, #7c3aed 100%)`,
            color: "white",
            fontSize: 18,
          }}
        >
          <RobotOutlined />
        </Flex>
        <Flex vertical gap={0}>
          <Text strong style={{ fontSize: 14, color: token.colorPrimary }}>
            AI Blog Assistant
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            powered by Claude AI
          </Text>
        </Flex>
        <Badge
          status="processing"
          color="#52c41a"
          text={
            <Text style={{ fontSize: 11, color: "#52c41a" }}>พร้อมใช้งาน</Text>
          }
          style={{ marginLeft: "auto" }}
        />
      </Flex>

      {/* ✨ Tab selector */}
      <Flex gap={6} wrap="wrap" style={{ marginBottom: 14 }}>
        {tabs.map((t) => (
          <Button
            key={t.key}
            size="small"
            type={activeTab === t.key ? "primary" : "default"}
            icon={t.icon}
            onClick={() => setActiveTab(t.key)}
            style={{ borderRadius: 8, fontSize: 12 }}
          >
            {t.label}
          </Button>
        ))}
      </Flex>

      {/* ✨ Input area ตาม tab */}
      <Flex vertical gap={10}>
        {activeTab === "title" && (
          <>
            <Input
              placeholder="ระบุหัวข้อที่ต้องการ เช่น: เทคนิคการสอนคณิตศาสตร์ป.4"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={{ borderRadius: 10 }}
            />
            <Select
              placeholder="หมวดหมู่ (ไม่บังคับ)"
              value={category || undefined}
              onChange={setCategory}
              allowClear
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              style={{ borderRadius: 10 }}
            />
          </>
        )}
        {activeTab === "content" && (
          <>
            {!currentTitle && (
              <Input
                placeholder="ชื่อบทความ (ถ้ายังไม่ได้ใส่ในฟอร์ม)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                style={{ borderRadius: 10 }}
              />
            )}
            <TextArea
              placeholder="โครงร่างบทความ (ไม่บังคับ) เช่น:\n- บทนำ\n- หัวข้อ 1\n- หัวข้อ 2\n- สรุป"
              rows={4}
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              style={{ borderRadius: 10, fontSize: 13 }}
            />
          </>
        )}
        {(activeTab === "excerpt" ||
          activeTab === "tags" ||
          activeTab === "seo") && (
          <Alert
            type="info"
            showIcon={false}
            title={
              <Text style={{ fontSize: 12 }}>
                {activeTab === "seo"
                  ? "AI จะวิเคราะห์จากชื่อบทความและเนื้อหาในฟอร์มปัจจุบัน"
                  : "AI จะใช้ชื่อบทความและเนื้อหาจากฟอร์มปัจจุบัน"}
              </Text>
            }
            style={{ borderRadius: 8, padding: "6px 12px" }}
          />
        )}

        <Button
          type="primary"
          icon={isAiLoading ? <LoadingOutlined /> : <RobotOutlined />}
          onClick={handleGenerate}
          loading={isAiLoading}
          style={{
            background: `linear-gradient(135deg, ${token.colorPrimary} 0%, #7c3aed 100%)`,
            border: "none",
            borderRadius: 10,
            fontWeight: 600,
          }}
        >
          {isAiLoading
            ? "AI กำลังประมวลผล..."
            : `Generate ${tabs.find((t) => t.key === activeTab)?.label}`}
        </Button>
      </Flex>

      {/* ✨ ผลลัพธ์ */}
      {isAiLoading && (
        <Flex justify="center" style={{ padding: "20px 0" }}>
          <Spin
            indicator={
              <LoadingOutlined
                style={{ fontSize: 24, color: token.colorPrimary }}
                spin
              />
            }
          />
        </Flex>
      )}

      {/* ✨ Title results */}
      {!isAiLoading && activeTab === "title" && generatedTitles.length > 0 && (
        <Flex vertical gap={6} style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
            เลือกชื่อที่ต้องการ:
          </Text>
          {generatedTitles.map((t, i) => (
            <Flex
              key={i}
              align="center"
              justify="space-between"
              style={{
                padding: "8px 12px",
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 8,
                cursor: "pointer",
              }}
              onClick={() => {
                onApplyTitle?.(t);
              }}
            >
              <Text style={{ fontSize: 13, flex: 1 }}>{t}</Text>
              <Tooltip title="นำไปใช้">
                <Button type="text" size="small" icon={<CopyOutlined />} />
              </Tooltip>
            </Flex>
          ))}
        </Flex>
      )}

      {/* ✨ Excerpt result */}
      {!isAiLoading && activeTab === "excerpt" && generatedExcerpt && (
        <Flex vertical gap={6} style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
            สรุปย่อที่ AI เขียน:
          </Text>
          <div
            style={{
              padding: "10px 12px",
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 13 }}>{generatedExcerpt}</Text>
          </div>
          <Button
            size="small"
            type="primary"
            ghost
            onClick={() => {
              onApplyExcerpt?.(generatedExcerpt);
            }}
          >
            นำไปใส่ในฟอร์ม
          </Button>
        </Flex>
      )}

      {/* ✨ Content result */}
      {!isAiLoading && activeTab === "content" && generatedContent && (
        <Flex vertical gap={6} style={{ marginTop: 12 }}>
          <Flex align="center" justify="space-between">
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
              เนื้อหาที่ AI เขียน (Markdown):
            </Text>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                onApplyContent?.(generatedContent);
              }}
            >
              นำไปใช้
            </Button>
          </Flex>
          <div
            style={{
              padding: "10px 12px",
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8,
              maxHeight: 200,
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {generatedContent.slice(0, 600)}
            {generatedContent.length > 600 ? "..." : ""}
          </div>
        </Flex>
      )}

      {/* ✨ Tags result */}
      {!isAiLoading && activeTab === "tags" && generatedTags.length > 0 && (
        <Flex vertical gap={6} style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
            Tags ที่ AI แนะนำ:
          </Text>
          <Flex gap={6} wrap="wrap">
            {generatedTags.map((tag) => (
              <Tag
                key={tag}
                style={{ cursor: "pointer", borderRadius: 6, fontSize: 12 }}
                onClick={() => {
                  onApplyTags?.(generatedTags);
                }}
              >
                {tag}
              </Tag>
            ))}
          </Flex>
          <Button
            size="small"
            type="primary"
            ghost
            onClick={() => {
              onApplyTags?.(generatedTags);
            }}
          >
            ใส่ tags ทั้งหมด
          </Button>
        </Flex>
      )}

      {/* ✨ SEO Score result */}
      {!isAiLoading && activeTab === "seo" && aiSeoScore && (
        <div style={{ marginTop: 12 }}>
          <SeoScoreCard score={aiSeoScore} />
        </div>
      )}
    </Card>
  );
}
