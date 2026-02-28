import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Segmented, Space, Tabs, Typography, message } from 'antd';
import { LockOutlined, MailOutlined, QrcodeOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import QRCode from 'react-qr-code';
import { useAuth } from '../../hooks/useAuth';
import AuthLayout from '../../layouts/AuthLayout';
import { useNavigate } from 'react-router-dom';
import { initIcbcLogin, fetchIcbcLoginStatus, authorizeIcbcSession } from '../../services/authService';

const { Title, Paragraph } = Typography;

const LoginPage = () => {
  const [activeTab, setActiveTab] = useState('admin');
  const [icbcToken, setIcbcToken] = useState('');
  const [icbcStep, setIcbcStep] = useState('idle');
  const [adminLoading, setAdminLoading] = useState(false);
  const [icbcLoading, setIcbcLoading] = useState(false);
  const [clientAccountType, setClientAccountType] = useState('PERSONAL');
  const [icbcSession, setIcbcSession] = useState(null);
  const [icbcStatus, setIcbcStatus] = useState('');
  const navigate = useNavigate();
  const pollIntervalRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const { login, finalizeIcbcSessionLogin, isAuthenticated, user, loading } = useAuth();

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollInFlightRef.current = false;
  }

  const resetIcbcState = (step = 'idle') => {
    stopPolling();
    setIcbcSession(null);
    setIcbcToken('');
    setIcbcStatus('');
    setIcbcStep(step);
  };

  const startPollingStatus = (sessionId) => {
    const poll = async () => {
      if (pollInFlightRef.current) {
        return;
      }
      pollInFlightRef.current = true;
      try {
        const statusData = await fetchIcbcLoginStatus(sessionId);
        if (!statusData) {
          return;
        }

        if (statusData.expiresAt) {
          setIcbcSession((prev) => (prev ? { ...prev, expiresAt: statusData.expiresAt } : prev));
        }

        const { status, token, user, errorMessage } = statusData;

        if (status === 'AUTHORIZED') {
          stopPolling();
          setIcbcStep('authorized');
          setIcbcStatus('授权成功，正在登录…');
          setIcbcToken('');
          setIcbcSession(null);
          finalizeIcbcSessionLogin({ token, user, icbcToken: sessionId });
          return;
        }

        if (status === 'EXPIRED') {
          stopPolling();
          setIcbcStep('expired');
          const expiredMessage = '二维码已过期，请重新生成';
          setIcbcStatus(expiredMessage);
          message.warning(expiredMessage);
          return;
        }

        if (status === 'FAILED') {
          stopPolling();
          setIcbcStep('failed');
          const failureMessage = errorMessage || '授权失败，请重新进行扫码';
          setIcbcStatus(failureMessage);
          message.error(failureMessage);
          return;
        }

        if (status === 'AUTHORIZED_PENDING') {
          setIcbcStatus('手机端已授权，正在准备登录…');
          return;
        }

        setIcbcStatus('等待手机端授权…');
      } catch (error) {
        console.error('轮询工行登录状态失败:', error);
      } finally {
        pollInFlightRef.current = false;
      }
    };

    poll();
    stopPolling();
    pollIntervalRef.current = window.setInterval(poll, 2000);
  };

  const handleGenerateQr = async () => {
    setIcbcLoading(true);
    try {
      resetIcbcState('idle');
      const session = await initIcbcLogin({ accountType: clientAccountType });
      setIcbcSession(session);
      setIcbcToken(session.qrContent);
      setIcbcStep('generated');
      setIcbcStatus('等待手机端授权…');
      message.success('已生成登录二维码');
      startPollingStatus(session.sessionId);
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || '生成二维码失败';
      message.error(errorMessage);
      resetIcbcState('idle');
    } finally {
      setIcbcLoading(false);
    }
  };

  const handleSimulateAuthorize = async () => {
    if (!icbcSession?.sessionId) {
      message.warning('请先生成二维码');
      return;
    }
    let testUserIdInput = '';
    try {
      testUserIdInput = await new Promise((resolve, reject) => {
        let tempValue = '';
        Modal.confirm({
          title: '输入测试用户 ID',
          centered: true,
          content: (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Typography.Text type="secondary">
                仅供测试使用，正式流程请通过工行手机银行授权登录。
              </Typography.Text>
              <Input
                placeholder="例如：9 或 10"
                autoFocus
                onChange={(event) => {
                  tempValue = event.target.value;
                }}
              />
            </Space>
          ),
          okText: '确认模拟授权',
          cancelText: '取消',
          onOk: () => resolve(tempValue.trim()),
          onCancel: () => reject(new Error('cancel'))
        });
      });
    } catch (promptError) {
      if (promptError?.message !== 'cancel') {
        console.warn('测试用户ID输入失败', promptError);
      }
      return;
    }

    setIcbcLoading(true);
    try {
      await authorizeIcbcSession({
        sessionId: icbcSession.sessionId,
        testUserId: testUserIdInput || null
      });
      message.success('已模拟手机端授权');
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || '模拟授权失败';
      message.error(errorMessage);
    } finally {
      setIcbcLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'SUPER_ADMIN' || user.role === 'ICBC_ADMIN' || user.role === 'BRAND_ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/client', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);


  const renderIcbcLoginInstruction = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="使用工行手机银行扫描二维码"
        description={`扫码后将跳转至工银溯藏授权页面，请确认您的${clientAccountType === 'ENTERPRISE' ? '企业资料' : '个人资料'}并授权平台获取基础信息。`}
      />
      <Space direction="vertical" style={{ width: '100%', alignItems: 'center' }}>
        {icbcStep !== 'idle' && (
          <Card variant="borderless" style={{ padding: 24, textAlign: 'center' }}>
            <QRCode value={icbcToken || '请点击下方按钮生成二维码'} size={200} />
            <Paragraph style={{ marginTop: 16 }}>
              {icbcStatus || '请使用工行手机银行扫描二维码完成身份认证。'}
            </Paragraph>
            {icbcSession?.expiresAt && (
              <Paragraph type="secondary">
                二维码有效期截止：{new Date(icbcSession.expiresAt).toLocaleString()}
              </Paragraph>
            )}
            {icbcSession?.sessionId && (
              <Paragraph type="secondary" style={{ wordBreak: 'break-all', marginTop: 8 }}>
                会话ID：{icbcSession.sessionId}
              </Paragraph>
            )}
            {icbcToken && (
              <Paragraph type="secondary" style={{ wordBreak: 'break-all', marginTop: 8 }}>
                调试二维码内容：{icbcToken}
              </Paragraph>
            )}
          </Card>
        )}
        <Space wrap>
          <Button
            icon={<QrcodeOutlined />}
            type="primary"
            loading={icbcLoading}
            onClick={handleGenerateQr}
          >
            {icbcStep === 'generated' || icbcStep === 'failed' || icbcStep === 'expired' ? '重新生成二维码' : '生成二维码'}
          </Button>
          {icbcStep === 'generated' && (
            <Button
              icon={<SafetyCertificateOutlined />}
              onClick={handleSimulateAuthorize}
              loading={icbcLoading || loading}
            >
              模拟手机授权
            </Button>
          )}
          {icbcStep === 'authorized' && (
            <Button type="primary" disabled>
              已完成授权
            </Button>
          )}
        </Space>
      </Space>
    </Space>
  );

  return (
    <AuthLayout>
      <div>
        <Title level={3}>欢迎使用工银溯藏平台</Title>
        <Paragraph type="secondary">
          请选择登录方式：管理员使用账号密码登录，企业/个人客户通过工行手机银行扫码注册与登录。
        </Paragraph>
        <Tabs
          style={{ marginTop: 24 }}
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'admin',
              label: '管理员登录',
              children: (
                <Form
                  layout="vertical"
                  onFinish={async (values) => {
                    setAdminLoading(true);
                    try {
                      await login({ email: values.email, password: values.password, role: 'ADMIN' });
                    } catch (error) {
                      message.error(error.message || '登录失败');
                    } finally {
                      setAdminLoading(false);
                    }
                  }}
                >
                  <Form.Item
                    label="管理员邮箱"
                    name="email"
                    rules={[{ required: true, message: '请输入管理员邮箱' }]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="admin@example.com" size="large" autoComplete="email" />
                  </Form.Item>
                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" autoComplete="current-password" />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      loading={adminLoading || loading}
                      block
                    >
                      登录后台
                    </Button>
                  </Form.Item>
                  <Alert
                    type="warning"
                    showIcon
                    message="仅限授权管理员使用"
                    description="品牌管理员、工行管理员及超级管理员可在此登录，客户请切换至“客户登录”。"
                  />
                </Form>
              )
            },
            {
              key: 'client',
              label: '客户登录',
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Alert
                    type="success"
                    showIcon
                    message="客户需通过工行手机银行扫码登录"
                    description="首次登录即完成注册，无需单独创建账户。根据您的身份类型，平台会定制化申请表单。"
                  />
                  <Card variant="borderless" style={{ paddingBottom: 0 }}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Typography.Text type="secondary">请选择登录身份：</Typography.Text>
                      <Segmented
                        size="large"
                        value={clientAccountType}
                        onChange={(value) => {
                          setClientAccountType(value);
                          if (icbcStep !== 'idle') {
                            resetIcbcState('idle');
                          }
                        }}
                        options={[
                          { label: '企业用户', value: 'ENTERPRISE' },
                          { label: '个人用户', value: 'PERSONAL' }
                        ]}
                      />
                    </Space>
                  </Card>
                  <Card title="扫码认证登录" variant="borderless">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Paragraph>
                        1. 打开工行手机银行 → 2. 点击“扫一扫” → 3. 扫描下方二维码 → 4. 确认授权信息
                      </Paragraph>
                      {renderIcbcLoginInstruction()}
                    </Space>
                  </Card>
                </Space>
              )
            }
          ]}
        />
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
