import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Button, Card, Col, Form, Input, Radio, Row, Select, Space, Typography, message } from 'antd';
import { SwapOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { requestCollectibleTransfer } from '../../services/collectibleService';
import { useAuth } from '../../hooks/useAuth';
import { getCurrentUserCollectibles } from '../../services/userService';
import { buildCollectibleImageSrc } from '../../utils/collectibleImage';

const CollectibleTransfer = () => {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const selectedAccountType = Form.useWatch('accountType', form) || (user?.accountType === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE');
  const [selectedCollectible, setSelectedCollectible] = useState(null);

  const { data: collectibles = { data: [] }, isLoading: loadingCollectibles } = useQuery({
    queryKey: ['me', 'collectibles', 'transfer-select'],
    queryFn: () => getCurrentUserCollectibles({ page: 1, limit: 100 })
  });

  const collectibleOptions = useMemo(() => {
    return (collectibles.data || []).map((item) => {
      const value = item.blockchainId || item.blockchain_id;
      const label = (
        <Space align="center">
          <Avatar
            shape="square"
            size={40}
            src={buildCollectibleImageSrc(item) || undefined}
            style={{ backgroundColor: '#f5f5f5' }}
          >
            {item.name?.[0] || '藏'}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{item.name || '未命名藏品'}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {value}
            </Typography.Text>
          </div>
        </Space>
      );

      return {
        label,
        value,
        raw: item
      };
    });
  }, [collectibles]);

  useEffect(() => {
    if (!form.isFieldsTouched(['accountType']) && user?.accountType) {
      form.setFieldsValue({ accountType: user.accountType === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE' });
    }
  }, [form, user]);

  const handleSubmit = async (values) => {
    const collectibleId = values.collectibleId;
    if (!collectibleId) {
      message.error('请选择要转移的藏品');
      return;
    }

    const targetUserId = values.targetUserId?.toString().trim();
    if (!targetUserId) {
      message.error('请输入受让人用户ID');
      return;
    }

    const accountType = (values.accountType || selectedAccountType || user?.accountType || 'ENTERPRISE').toUpperCase();
    const payload = {
      targetUserId,
      accountType,
      note: values.note?.trim() || null
    };

    if (accountType === 'ENTERPRISE') {
      payload.enterpriseInfo = {
        registrationNumber: values.enterpriseInfo?.registrationNumber?.trim() || '',
        companyName: values.enterpriseInfo?.companyName?.trim() || ''
      };
    } else {
      payload.personalInfo = {
        platform: values.personalInfo?.platform?.trim() || '',
        platformId: values.personalInfo?.platformId?.trim() || '',
        personalName: values.personalInfo?.personalName?.trim() || ''
      };
    }

    setSubmitting(true);
    try {
      await requestCollectibleTransfer(collectibleId, payload);
      message.success('转移申请已提交，待超级管理员审批');
      form.resetFields();
      setSelectedCollectible(null);
      form.setFieldsValue({
        accountType: accountType === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE'
      });
    } catch (error) {
      message.error(error.message || '提交转移申请失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3}>藏品转移申请</Typography.Title>
        <Typography.Paragraph type="secondary">
          输入藏品编号及受让人信息，上传对应的企业或个人资质，提交后由超级管理员在“所有权转移确认”中审批。
        </Typography.Paragraph>
      </div>
      <Card variant="borderless">
        <Alert
          type="info"
          showIcon
          message="操作须知"
          description={
            <span>
              审批通过后将触发链上所有权转移。请确认受让人已在平台完成注册，并确保填写的资质材料真实有效。
            </span>
          }
          style={{ marginBottom: 24 }}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            accountType: user?.accountType === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE',
            enterpriseInfo: { registrationNumber: '', companyName: '' },
            personalInfo: { platform: '', platformId: '', personalName: '' }
          }}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="collectibleId"
                label="选择藏品"
                rules={[{ required: true, message: '请选择需要转移的藏品' }]}
              >
                <Select
                  placeholder="请选择要转移的藏品"
                  loading={loadingCollectibles}
                  options={collectibleOptions}
                  showSearch
                  optionFilterProp="children"
                  onChange={(value) => {
                    const option = collectibleOptions.find((item) => item.value === value);
                    setSelectedCollectible(option?.raw || null);
                  }}
                  suffixIcon={<SwapOutlined />}
                  filterOption={(input, option) => {
                    const text = option?.raw?.name || option?.value;
                    return (text || '').toLowerCase().includes(input.toLowerCase());
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="targetUserId"
                label="受让人用户ID"
                tooltip="请填写平台内受让人的用户ID"
                rules={[{ required: true, message: '请输入受让人用户ID' }]}
              >
                <Input prefix={<UserSwitchOutlined />} placeholder="例如：1024" />
              </Form.Item>
            </Col>
          </Row>

          {selectedCollectible && (
            <Card
              type="inner"
              size="small"
              style={{ marginBottom: 24 }}
              title="已选择的藏品"
            >
              <Space align="center">
                <Avatar
                  shape="square"
                  size={64}
                  src={buildCollectibleImageSrc(selectedCollectible) || undefined}
                  style={{ backgroundColor: '#f0f0f0' }}
                >
                  {selectedCollectible.name?.[0] || '藏'}
                </Avatar>
                <div>
                  <Typography.Text strong>{selectedCollectible.name || '未命名藏品'}</Typography.Text>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    编号：{selectedCollectible.blockchainId || selectedCollectible.blockchain_id}
                  </Typography.Paragraph>
                </div>
              </Space>
            </Card>
          )}

          <Form.Item name="accountType" label="受让方资质类型" rules={[{ required: true, message: '请选择资质类型' }]}
            help={selectedAccountType === 'PERSONAL' ? '请填写受让人的个人创作者信息' : '请填写受让人的企业资质信息'}>
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio.Button value="ENTERPRISE">企业资质</Radio.Button>
              <Radio.Button value="PERSONAL">个人资质</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {selectedAccountType === 'ENTERPRISE' ? (
            <Card type="inner" title="企业资质信息" style={{ marginBottom: 24 }}>
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
            </Card>
          ) : (
            <Card type="inner" title="个人资质信息" style={{ marginBottom: 24 }}>
              <Row gutter={24}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name={['personalInfo', 'platform']}
                    label="创作者平台"
                    rules={[{ required: true, message: '请输入创作者平台' }]}
                  >
                    <Input placeholder="如：抖音、B站等" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name={['personalInfo', 'platformId']}
                    label="平台ID/作品编号"
                    rules={[{ required: true, message: '请输入平台ID或作品编号' }]}
                  >
                    <Input placeholder="请输入平台ID或作品编号" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name={['personalInfo', 'personalName']}
                    label="创作者姓名"
                    rules={[{ required: true, message: '请输入创作者姓名' }]}
                  >
                    <Input placeholder="请输入创作者姓名" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          <Form.Item name="note" label="补充说明 (可选)">
            <Input.TextArea rows={3} placeholder="如有额外说明，可在此处补充" maxLength={200} showCount allowClear />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" loading={submitting}>
              提交转移申请
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CollectibleTransfer;
