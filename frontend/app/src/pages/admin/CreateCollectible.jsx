import React, { useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Radio, Row, Select, Space, Typography, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createCollectible } from '../../services/collectibleService';
import { useAuth } from '../../hooks/useAuth';

const { Title, Paragraph } = Typography;

const collectibleTypeOptions = [
  { label: '纪念币', value: 'MEMORIAL_COIN' },
  { label: '摆件', value: 'ARTWORK' },
  { label: '吧唧', value: 'DIGITAL' },
  { label: '手办', value: 'CREATIVE_MERCH' },
  { label: '其他', value: 'OTHER' }
];

const { Dragger } = Upload;

const CreateCollectible = () => {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const creationType = Form.useWatch('creationType', form) || 'ENTERPRISE';
  const [productPhotoList, setProductPhotoList] = useState([]);
  const isSuperAdmin = useMemo(() => user?.role === 'SUPER_ADMIN', [user?.role]);

  const normalizeUploadEvent = (event) => {
    if (Array.isArray(event)) {
      return event;
    }
    return event?.fileList?.slice(-1) || [];
  };

  const handleSubmit = async (values) => {
    if (!productPhotoList.length || !productPhotoList[0]?.originFileObj) {
      message.error('请上传产品照片');
      return;
    }

    const creationTypeValue = values.creationType || 'ENTERPRISE';
    const enterpriseInfo = values.enterpriseInfo || {};
    const personalInfo = values.personalInfo || {};

    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('description', values.description);
    formData.append('estimatedValue', values.estimatedValue !== undefined && values.estimatedValue !== null ? values.estimatedValue : 0);
    formData.append('collectibleType', values.collectibleType);
    if (values.publishDate) {
      formData.append('publishDate', values.publishDate.format('YYYY-MM-DD'));
    }
    formData.append('creationType', creationTypeValue);

    if (creationTypeValue === 'ENTERPRISE') {
      formData.append('enterpriseRegistrationNumber', enterpriseInfo.registrationNumber || '');
      formData.append('enterpriseName', enterpriseInfo.companyName || '');
    } else {
      formData.append('personalPlatform', personalInfo.platform || '');
      formData.append('personalPlatformId', personalInfo.platformId || '');
      formData.append('personalName', personalInfo.personalName || '');
    }

    const photoFile = productPhotoList[0]?.originFileObj;
    if (photoFile) {
      formData.append('productPhoto', photoFile, photoFile.name);
    }

    try {
      await createCollectible(formData);
      message.success(isSuperAdmin ? '藏品已成功创建并上链' : '藏品创建指令已提交，待审批后将自动上链');
      form.resetFields();
      setProductPhotoList([]);
    } catch (error) {
      message.error(error.message || '创建藏品失败');
    }
  };

  return (
    <div>
      <div className="page-header">
        <Title level={3}>新建藏品档案</Title>
        <Paragraph type="secondary">
          {isSuperAdmin
            ? '超级管理员创建后将立即写入区块链并生成二维码。'
            : '创建后将进入审批流程，审批通过后自动写入区块链并生成二维码。'}
        </Paragraph>
      </div>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ creationType: 'ENTERPRISE' }}
      >
        <Card title="创作主体信息" variant="borderless">
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="creationType"
                label="选择创作类型"
                rules={[{ required: true, message: '请选择创作类型' }]}
              >
                <Radio.Group>
                  <Radio.Button value="ENTERPRISE">公司创作</Radio.Button>
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
                    label="创作者平台"
                    rules={[{ required: true, message: '请输入创作者平台' }]}
                  >
                    <Input placeholder="如：哔哩哔哩、小红书" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['personalInfo', 'platformId']}
                    label="平台 ID 号"
                    rules={[{ required: true, message: '请输入平台 ID 号' }]}
                  >
                    <Input placeholder="请输入平台账号或作品编号" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['personalInfo', 'personalName']}
                    label="个人姓名"
                    rules={[{ required: true, message: '请输入个人姓名' }]}
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
                label="产品名称"
                rules={[{ required: true, message: '请输入产品名称' }]}
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
                label="产品描述"
                rules={[{ required: true, message: '请填写产品描述' }]}
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
          <Row>
            <Col span={24}>
              <Form.Item
                name="productPhoto"
                label="产品照片"
                valuePropName="fileList"
                getValueFromEvent={normalizeUploadEvent}
                rules={[
                  {
                    validator: async () => {
                      if (!productPhotoList.length) {
                        throw new Error('请上传产品照片');
                      }
                    }
                  }
                ]}
              >
                <Dragger
                  multiple={false}
                  accept="image/*"
                  beforeUpload={() => false}
                  fileList={productPhotoList}
                  onChange={({ fileList }) => {
                    const nextList = fileList.slice(-1);
                    setProductPhotoList(nextList);
                    form.setFieldsValue({ productPhoto: nextList });
                    form.validateFields(['productPhoto']).catch(() => {});
                  }}
                  onRemove={() => {
                    setProductPhotoList([]);
                    form.setFieldsValue({ productPhoto: [] });
                    form.validateFields(['productPhoto']).catch(() => {});
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽图片到此处，支持 JPG/PNG 等格式，大小不超过 10MB</p>
                  <p className="ant-upload-hint">上传后将直接保存到后台数据库，请确认已获得相关授权</p>
                </Dragger>
              </Form.Item>
            </Col>
          </Row>
  </Card>

        <Form.Item style={{ marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" size="large">
              {isSuperAdmin ? '立即上链' : '提交审批'}
            </Button>
            <Button
              onClick={() => {
                form.resetFields();
                setProductPhotoList([]);
              }}
              size="large"
            >
              重置表单
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};

export default CreateCollectible;
