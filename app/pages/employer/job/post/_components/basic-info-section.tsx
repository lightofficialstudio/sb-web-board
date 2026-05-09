"use client";

import { ThunderboltOutlined } from "@ant-design/icons";
import { Card, Col, Form, Input, InputNumber, Row, Select, Space, theme } from "antd";

const { Option } = Select;

// ส่วนกรอกข้อมูลพื้นฐานของตำแหน่งงาน: ชื่อ, รูปแบบ, จำนวน, วิชา, ระดับชั้น
export const BasicInfoSection = () => {
  const { token } = theme.useToken();

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
        <Col xs={24} md={16}>
          <Form.Item
            label="ตำแหน่งงาน"
            name="title"
            rules={[{ required: true, message: "กรุณาระบุตำแหน่งงาน" }]}
            tooltip="เช่น ครูภาษาอังกฤษ, ครูสอนศิลปะ"
          >
            <Input size="large" placeholder="ระบุตำแหน่งงาน" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="รูปแบบงาน"
            name="employmentType"
            rules={[{ required: true, message: "กรุณาเลือกรูปแบบงาน" }]}
          >
            <Select size="large" placeholder="เลือกรูปแบบงาน">
              <Option value="FULL_TIME">งานเต็มเวลา (Full-time)</Option>
              <Option value="PART_TIME">งานพาร์ทไทม์ (Part-time)</Option>
              <Option value="CONTRACT">สัญญาจ้าง</Option>
              <Option value="INTERNSHIP">ฝึกงาน</Option>
              <Option value="STUDENT_TEACHER">นักศึกษาฝึกสอน</Option>
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
        <Col xs={24} md={16}>
          <Form.Item
            label="วิชาที่สอน"
            name="subjects"
            rules={[{ required: true, message: "กรุณาเลือกวิชาที่สอน" }]}
          >
            <Select size="large" placeholder="เลือกวิชาที่สอน" style={{ width: "100%" }}>
              <Option value="ภาษาอังกฤษ">ภาษาอังกฤษ</Option>
              <Option value="คณิตศาสตร์">คณิตศาสตร์</Option>
              <Option value="วิทยาศาสตร์">วิทยาศาสตร์</Option>
              <Option value="ภาษาไทย">ภาษาไทย</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item
            label="ระดับชั้นที่สอน"
            name="grades"
          >
            <Select mode="multiple" size="large" placeholder="เลือกระดับชั้น" style={{ width: "100%" }}>
              <Option value="อนุบาล">อนุบาล</Option>
              <Option value="ประถมศึกษา">ประถมศึกษา</Option>
              <Option value="มัธยมต้น">มัธยมต้น</Option>
              <Option value="มัธยมปลาย">มัธยมปลาย</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};
