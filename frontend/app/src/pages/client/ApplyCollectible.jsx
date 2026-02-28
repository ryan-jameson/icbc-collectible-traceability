import React, { useEffect } from 'react';
import { Alert, Button, Card, Col, Form, Input, Radio, Row, Typography, message } from 'antd';
import { QrcodeOutlined } from '@ant-design/icons';
import { claimCollectible } from '../../services/collectibleService';
import { useAuth } from '../../hooks/useAuth';

const { Title, Paragraph } = Typography;

const ApplyCollectible = () => {
  const [form] = Form.useForm();
  const { icbcSessionToken, user } = useAuth();
  const selectedAccountType = Form.useWatch('accountType', form) || (user?.accountType === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE');

  useEffect(() => {
    if (!form.isFieldsTouched(['accountType']) && user?.accountType) {
      form.setFieldsValue({ accountType: user.accountType === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE' });
    }
  }, [form, user]);

  const handleSubmit = async (values) => {
    if (!icbcSessionToken) {
      message.error('请先通过工行手机银行完成扫码登录');
      return;
    }

    const collectibleId = values.collectibleId?.trim();
    if (!collectibleId) {
      message.error('请输入有效的藏品编号');
      return;
    }

    const accountType = (values.accountType || selectedAccountType || user?.accountType || 'ENTERPRISE').toUpperCase();

    const applicationDetails = {
      accountType,
      collectibleId
    };

    if (accountType === 'ENTERPRISE') {
      applicationDetails.enterpriseInfo = {
        registrationNumber: values.enterpriseInfo?.registrationNumber?.trim() || '',
        companyName: values.enterpriseInfo?.companyName?.trim() || ''
      };
    } else {
      applicationDetails.personalInfo = {
        platform: values.personalInfo?.platform?.trim() || '',
        platformId: values.personalInfo?.platformId?.trim() || '',
        personalName: values.personalInfo?.personalName?.trim() || ''
      };
    }

    try {
      await claimCollectible(collectibleId, icbcSessionToken, applicationDetails);
      message.success('认领申请已提交，待管理员审核后将完成链上确认');
      form.resetFields();
      form.setFieldsValue({
        accountType: accountType === 'PERSONAL' ? 'PERSONAL' : 'ENTERPRISE'
      });
    } catch (error) {
      message.error(error.message || '认领失败');
    }
  };

  return (
    <div>
      <div className="page-header">
        <Title level={3}>认领藏品</Title>
        <Paragraph type="secondary">
          输入品牌方提供的藏品编号，并根据自身类型填写企业或个人资质信息。管理员确认后，将由链码完成所有权转移。
        </Paragraph>
      </div>
      <Card variant="borderless">
        <Alert
          type="info"
          showIcon
          message="温馨提示"
          description={
            <span>
              审批通过后将立即写入区块链，并将藏品所有权转移至您的账户。请确保填写的资质信息真实可信。
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
          <Form.Item
            name="collectibleId"
            label="藏品编号"
            rules={[{ required: true, message: '请输入藏品编号' }]}
          >
            <Input prefix={<QrcodeOutlined />} placeholder="如：COL-20251005-ABCD" />
          </Form.Item>

          <Form.Item name="accountType" label="资质类型" rules={[{ required: true, message: '请选择资质类型' }]}
            help={selectedAccountType === 'PERSONAL' ? '请选择并填写个人创作者的资质信息' : '请选择并填写企业资质信息'}>
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio.Button value="ENTERPRISE" disabled={user?.accountType === 'PERSONAL'}>企业资质</Radio.Button>
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
                    <Input placeholder="如：B站、微博等" />
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

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large">
              提交审批
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ApplyCollectible;
