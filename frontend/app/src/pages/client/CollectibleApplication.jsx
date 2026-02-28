import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Form, Input, InputNumber, Radio, Row, Select, Space, Typography, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { submitCollectibleApplication } from '../../services/collectibleService';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

const collectibleTypeOptions = [
  { label: '纪念币', value: 'MEMORIAL_COIN' },
  { label: '摆件', value: 'ARTWORK' },
  { label: '吧唧', value: 'DIGITAL' },
  { label: '手办', value: 'CREATIVE_MERCH' },
  { label: '其他', value: 'OTHER' }
];

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

const CollectibleApplication = () => {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const defaultCreationType = useMemo(() => (user?.accountType === 'ENTERPRISE' ? 'ENTERPRISE' : 'PERSONAL'), [user?.accountType]);
  const creationType = Form.useWatch('creationType', form) || defaultCreationType;
  const [attachmentList, setAttachmentList] = useState([]);
  const [attachmentPayload, setAttachmentPayload] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const toBase64 = useCallback((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  }), []);

  const normalizeFileList = useCallback((fileList) => {
    if (!fileList) {
      return [];
    }
    if (Array.isArray(fileList)) {
      return fileList;
    }
    if (typeof fileList === 'object' && typeof fileList.forEach === 'function') {
      return Array.from(fileList);
    }
    return [];
  }, []);

  const handleAttachmentChange = useCallback(async ({ fileList }) => {
    const normalizedList = normalizeFileList(fileList);
    const sizeLimitedList = normalizedList.filter((item) => {
      const rawSize = item.size || item.originFileObj?.size || 0;
      if (rawSize > MAX_ATTACHMENT_SIZE) {
        message.error(`${item.name} 超过 5MB，已自动忽略`);
        return false;
      }
      return true;
    });
    const sanitizedList = sizeLimitedList.slice(0, 3);
    setAttachmentList(sanitizedList);

    const processed = await Promise.all(sanitizedList.map(async (item) => {
      if (item.originFileObj) {
        const base64 = await toBase64(item.originFileObj);
        return {
          uid: item.uid,
          name: item.name,
          type: item.originFileObj.type,
          size: item.originFileObj.size,
          content: base64
        };
      }

      if (item.base64Content || item.content) {
        return {
          uid: item.uid,
          name: item.name,
          type: item.type,
          size: item.size,
          content: item.base64Content || item.content
        };
      }

      return {
        uid: item.uid,
        name: item.name,
        type: item.type,
        size: item.size,
        content: null
      };
    }));

    setAttachmentPayload(processed.filter((item) => Boolean(item.content)));
  }, [normalizeFileList, toBase64]);

  const handleAttachmentRemove = useCallback((file) => {
    setAttachmentList((prev) => prev.filter((item) => item.uid !== file.uid));
    setAttachmentPayload((prev) => prev.filter((item) => item.uid !== file.uid));
    return true;
  }, []);

  const buildPayload = (values) => {
    const attachments = attachmentPayload
      .map((item) => ({
        name: item.name,
        type: item.type,
        size: item.size,
        content: item.content
      }));

    return {
      name: values.name,
      description: values.description,
      collectibleType: values.collectibleType,
      publishDate: values.publishDate ? values.publishDate.format('YYYY-MM-DD') : null,
      estimatedValue: values.estimatedValue !== undefined && values.estimatedValue !== null ? values.estimatedValue : 0,
      creationType: values.creationType || defaultCreationType,
      enterpriseInfo: values.enterpriseInfo,
      personalInfo: values.personalInfo,
      attachments
    };
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = buildPayload(values);
      await submitCollectibleApplication(payload);
      message.success('申请已提交，待超级管理员审批');
      form.resetFields();
      setAttachmentList([]);
      setAttachmentPayload([]);
      queryClient.invalidateQueries({ queryKey: ['me', 'collectible-applications'] });
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || '提交失败';
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <Title level={3}>申请新藏品</Title>
        <Paragraph type="secondary">
          请填写完整的创作与藏品信息，提交后将由超级管理员审核。审批通过后，藏品会由平台统一上线。
        </Paragraph>
      </div>
      <Alert
        type="info"
        showIcon
        message="当前登录身份"
        description={
          <span>
            您正在以<Text strong>{defaultCreationType === 'ENTERPRISE' ? '企业用户' : '个人用户'}</Text>身份申请藏品。
            审批通过前，藏品不会写入区块链。
          </span>
        }
        style={{ marginBottom: 24 }}
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ creationType: defaultCreationType }}
      >
        <Card title="创作主体信息" variant="borderless">
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item name="creationType" label="创作类型">
                <Radio.Group value={creationType} disabled>
                  <Radio.Button value="ENTERPRISE">企业创作</Radio.Button>
                  <Radio.Button value="PERSONAL">个人创作</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          {creationType === 'ENTERPRISE' && (
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name={['enterpriseInfo', 'registrationNumber']}
                  label="企业注册号"
                  rules={[{ required: true, message: '请输入企业注册号' }]}
                >
                  <Input placeholder="请输入企业注册号" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name={['enterpriseInfo', 'companyName']}
                  label="企业名称"
                  rules={[{ required: true, message: '请输入企业名称' }]}
                >
                  <Input placeholder="请输入企业名称" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {creationType === 'PERSONAL' && (
            <>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['personalInfo', 'platform']}
                    label="创作平台"
                    rules={[{ required: true, message: '请输入创作平台' }]}
                  >
                    <Input placeholder="如：哔哩哔哩、小红书" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['personalInfo', 'platformId']}
                    label="平台账号/作品编号"
                    rules={[{ required: true, message: '请输入平台账号或编号' }]}
                  >
                    <Input placeholder="请输入平台账号或作品编号" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['personalInfo', 'personalName']}
                    label="创作者姓名"
                    rules={[{ required: true, message: '请输入创作者姓名' }]}
                  >
                    <Input placeholder="请输入创作者姓名" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </Card>

        <Card title="藏品基础信息" variant="borderless" style={{ marginTop: 24 }}>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="藏品名称"
                rules={[{ required: true, message: '请输入藏品名称' }]}
              >
                <Input placeholder="如：青花瓷 · 工银限定版" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="estimatedValue"
                label="预估价值 (人民币)"
                rules={[{ type: 'number', min: 0 }]}
              >
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入预估价值" />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col span={24}>
              <Form.Item
                name="description"
                label="藏品描述"
                rules={[{ required: true, message: '请填写藏品描述' }]}
              >
                <Input.TextArea rows={4} maxLength={500} placeholder="描述产品亮点、授权信息、工艺流程等" showCount />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="collectibleType"
                label="藏品类型"
                rules={[{ required: true, message: '请选择藏品类型' }]}
              >
                <Select options={collectibleTypeOptions} placeholder="请选择藏品类型" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="publishDate"
                label="发布日期"
                rules={[{ required: true, message: '请选择发布日期' }]}
              >
                <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current > dayjs()} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="可选附件" variant="borderless" style={{ marginTop: 24 }}>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            可上传产品设计稿、授权证明等辅助材料（最多 3 份，单个文件不超过 5MB）。
          </Paragraph>
          <Form.Item>
            <Dragger
              multiple
              accept="image/*,application/pdf"
              beforeUpload={() => false}
              fileList={attachmentList}
              onChange={handleAttachmentChange}
              onRemove={handleAttachmentRemove}
              customRequest={({ onSuccess }) => {
                if (onSuccess) {
                  onSuccess('ok');
                }
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">附件仅用于审批参考，不会公开展示</p>
            </Dragger>
          </Form.Item>
        </Card>

        <Form.Item style={{ marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" size="large" loading={submitting}>
              提交审批
            </Button>
            <Button
              size="large"
              onClick={() => {
                form.resetFields();
                setAttachmentList([]);
              }}
              disabled={submitting}
            >
              重置表单
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};

export default CollectibleApplication;
