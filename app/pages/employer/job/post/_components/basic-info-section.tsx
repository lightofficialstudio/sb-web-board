"use client";

import { ThunderboltOutlined } from "@ant-design/icons";
import { AutoComplete, Card, Col, Form, InputNumber, Row, Select, Space, theme } from "antd";
import { useEffect, useRef, useState } from "react";
import { type ConfigOption, requestFetchConfigOptions } from "../_api/job-post-api";
import { useJobPostStore } from "../_stores/job-post-store";

// ✨ positions ที่มี parentValue = "requires_subject" → แสดง subject fields
const REQUIRES_SUBJECT_MARKER = "requires_subject";

// ส่วนกรอกข้อมูลพื้นฐานของตำแหน่งงาน: ตำแหน่ง, รูปแบบ, จำนวน, วิชา, ระดับชั้น
export const BasicInfoSection = () => {
  const { token } = theme.useToken();
  const form = Form.useFormInstance();
  const { setPositionOptions } = useJobPostStore();

  // ✨ ดึง job_position — root = ตำแหน่งทั่วไป, parentValue="requires_subject" = ตำแหน่งครู
  const [positionOptions, setLocalPositionOptions] = useState<ConfigOption[]>([]);
  // ✨ ดึง job_category — root = กลุ่มวิชา, children = วิชาย่อย
  const [categoryOptions, setCategoryOptions] = useState<ConfigOption[]>([]);

  const [selectedPosition, setSelectedPosition] = useState<ConfigOption | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  // ✨ ค่าที่แสดงใน AutoComplete input
  const [inputValue, setInputValue] = useState<string>("");
  // ✨ ป้องกัน sync edit-mode ซ้ำ
  const didSyncEdit = useRef(false);

  useEffect(() => {
    requestFetchConfigOptions("job_position").then((opts) => {
      setLocalPositionOptions(opts);
      // ✨ แชร์ไปที่ store เพื่อให้ page.tsx ใช้ suggest ตอน submit
      setPositionOptions(opts);
    });
    requestFetchConfigOptions("job_category").then(setCategoryOptions);
  }, [setPositionOptions]);

  // ✨ sync inputValue กับ form field title เมื่อ edit mode โหลดข้อมูลเสร็จ
  const titleFieldValue = Form.useWatch("title", form);
  useEffect(() => {
    if (didSyncEdit.current) return;
    if (!titleFieldValue) return;
    didSyncEdit.current = true;
    setInputValue(String(titleFieldValue));
  }, [titleFieldValue]);

  // ✨ ตำแหน่งที่แสดงใน AutoComplete (ไม่รวม marker node)
  const selectablePositions = positionOptions.filter(
    (o) => o.value !== REQUIRES_SUBJECT_MARKER,
  );

  const autoCompleteOptions = selectablePositions.map((o) => ({
    label: o.label,
    value: o.label,
  }));

  // ✨ position นี้ต้องการระบุวิชาหรือไม่
  const requiresSubject = selectedPosition?.parentValue === REQUIRES_SUBJECT_MARKER;

  // ✨ root items ของ job_category คือ กลุ่มวิชา
  const groupOptions = categoryOptions.filter((o) => o.parentValue === null);

  // ✨ วิชาย่อยของ group ที่เลือก
  const subjectOptions = selectedGroup
    ? categoryOptions.filter((o) => o.parentValue === selectedGroup)
    : [];

  // ✨ เมื่อ user เลือก option จาก dropdown
  const handlePositionSelect = (displayLabel: string) => {
    const found = positionOptions.find((o) => o.label === displayLabel) ?? null;
    setSelectedPosition(found);
    setInputValue(displayLabel);
    form.setFieldValue("titleLabel", displayLabel);
    form.setFieldValue("title", displayLabel);
    form.setFieldValue("subjectGroup", undefined);
    form.setFieldValue("subjects", undefined);
    setSelectedGroup("");
  };

  // ✨ เมื่อ user พิมพ์ — แค่ update display state, ไม่ call API
  const handlePositionChange = (text: string) => {
    setInputValue(text);
    const found = positionOptions.find((o) => o.label === text) ?? null;
    setSelectedPosition(found);
    form.setFieldValue("titleLabel", text);
    form.setFieldValue("title", text);
    if (found?.parentValue !== REQUIRES_SUBJECT_MARKER) {
      form.setFieldValue("subjectGroup", undefined);
      form.setFieldValue("subjects", undefined);
      setSelectedGroup("");
    }
  };

  const handleGroupChange = (value: string) => {
    setSelectedGroup(value);
    form.setFieldValue("subjects", undefined);
  };

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: token.colorPrimary }} />
          ข้อมูลตำแหน่งงาน
        </Space>
      }
      variant="borderless"
      style={{ borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}` }}
    >
      <Row gutter={[16, 16]}>
        {/* ✨ ตำแหน่งงาน — AutoComplete กรอกเองได้ หรือเลือกจาก config */}
        <Col xs={24} md={16}>
          <Form.Item
            label="ตำแหน่งงาน"
            name="title"
            rules={[{ required: true, message: "กรุณาระบุตำแหน่งงาน" }]}
          >
            <AutoComplete
              size="large"
              placeholder="เลือกหรือพิมพ์ตำแหน่งงาน เช่น ครู, รปภ., เสมียน"
              options={autoCompleteOptions}
              value={inputValue}
              onChange={handlePositionChange}
              onSelect={handlePositionSelect}
              filterOption={(input, option) =>
                String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item
            label="รูปแบบงาน"
            name="employmentType"
            rules={[{ required: true, message: "กรุณาเลือกรูปแบบงาน" }]}
          >
            <Select size="large" placeholder="เลือกรูปแบบงาน">
              <Select.Option value="FULL_TIME">งานเต็มเวลา (Full-time)</Select.Option>
              <Select.Option value="PART_TIME">งานพาร์ทไทม์ (Part-time)</Select.Option>
              <Select.Option value="CONTRACT">สัญญาจ้าง</Select.Option>
              <Select.Option value="INTERNSHIP">ฝึกงาน</Select.Option>
              <Select.Option value="STUDENT_TEACHER">นักศึกษาฝึกสอน</Select.Option>
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item
            label="จำนวนที่รับ (คน)"
            name="vacancyCount"
            rules={[{ required: true, message: "กรุณาระบุจำนวนที่รับ" }]}
          >
            <InputNumber size="large" min={1} style={{ width: "100%" }} />
          </Form.Item>
        </Col>

        {/* ✨ แสดง subject fields เฉพาะตำแหน่งที่มี parentValue = "requires_subject" */}
        {requiresSubject && (
          <>
            <Col xs={24} md={8}>
              <Form.Item label="กลุ่มวิชา" name="subjectGroup">
                <Select
                  size="large"
                  placeholder="เลือกกลุ่มวิชา"
                  loading={categoryOptions.length === 0}
                  onChange={handleGroupChange}
                  options={groupOptions.map((o) => ({ label: o.label, value: o.value }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="วิชาที่สอน"
                name="subjects"
                rules={[{ required: true, message: "กรุณาเลือกวิชาที่สอน" }]}
              >
                <Select
                  size="large"
                  placeholder={selectedGroup ? "เลือกวิชาที่สอน" : "เลือกกลุ่มวิชาก่อน"}
                  disabled={!selectedGroup}
                  options={subjectOptions.map((o) => ({ label: o.label, value: o.value }))}
                />
              </Form.Item>
            </Col>
          </>
        )}

        <Col span={24}>
          <Form.Item label="ระดับชั้นที่สอน" name="grades">
            <Select mode="multiple" size="large" placeholder="เลือกระดับชั้น" style={{ width: "100%" }}>
              <Select.Option value="อนุบาล">อนุบาล</Select.Option>
              <Select.Option value="ประถมศึกษา">ประถมศึกษา</Select.Option>
              <Select.Option value="มัธยมต้น">มัธยมต้น</Select.Option>
              <Select.Option value="มัธยมปลาย">มัธยมปลาย</Select.Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};
