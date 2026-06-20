"use client";

import { Button, Flex, Modal, Slider, Typography, theme as antTheme } from "antd";
import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

const { Text } = Typography;

// ✨ แปลง canvas → Blob สำหรับ upload
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });

const getCroppedBlob = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.92,
    ),
  );
};

interface AvatarCropModalProps {
  open: boolean;
  imageSrc: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  open,
  imageSrc,
  loading,
  onCancel,
  onConfirm,
}) => {
  const { token } = antTheme.useToken();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedPixels) return;
    setIsCropping(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedPixels);
      onConfirm(blob);
    } finally {
      setIsCropping(false);
    }
  };

  const handleCancel = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title="ครอปรูปโปรไฟล์"
      footer={null}
      width={460}
      centered
      closable={!loading && !isCropping}
      maskClosable={false}
    >
      <Flex vertical gap={16} style={{ paddingTop: 8 }}>
        {/* ─── Crop Area ─── */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 300,
            background: "#111",
            borderRadius: token.borderRadius,
            overflow: "hidden",
          }}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* ─── Zoom Slider ─── */}
        <Flex align="center" gap={12}>
          <Text style={{ fontSize: 12, color: token.colorTextSecondary, whiteSpace: "nowrap" }}>
            ซูม
          </Text>
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={setZoom}
            style={{ flex: 1 }}
            tooltip={{ formatter: null }}
          />
        </Flex>

        {/* ─── Buttons ─── */}
        <Flex justify="end" gap={8}>
          <Button onClick={handleCancel} disabled={isCropping || loading}>
            ยกเลิก
          </Button>
          <Button
            type="primary"
            onClick={handleConfirm}
            loading={isCropping || loading}
          >
            ยืนยัน
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
};
