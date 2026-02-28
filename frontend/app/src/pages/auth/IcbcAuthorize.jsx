import React, { useEffect, useState } from 'react';
import { Button, Card, Result, Space, Spin, Typography, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { authorizeIcbcSession, fetchIcbcLoginStatus } from '../../services/authService';

const { Title, Paragraph, Text } = Typography;

const STATUS_LABELS = {
  ENTERPRISE: '企业客户',
  PERSONAL: '个人客户'
};

const IcbcAuthorize = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [loading, setLoading] = useState(true);
  const [authorizing, setAuthorizing] = useState(false);
  const [status, setStatus] = useState({ state: 'INIT', accountType: null, expiresAt: null, error: null });

  const loadStatus = async (showMessages = false) => {
    if (!sessionId) {
      setStatus({ state: 'MISSING_SESSION', accountType: null, expiresAt: null, error: '未提供会话ID' });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchIcbcLoginStatus(sessionId);
      if (!data) {
        setStatus({ state: 'NOT_FOUND', accountType: null, expiresAt: null, error: '扫码会话不存在或已过期' });
        return;
      }

      const nextState = {
        state: data.status,
        accountType: data.accountType,
        expiresAt: data.expiresAt || null,
        error: data.error || null,
        errorMessage: data.errorMessage || null
      };

      if (showMessages) {
        if (data.status === 'EXPIRED') {
          message.warning('二维码已过期，请返回电脑端重新生成');
        } else if (data.status === 'FAILED') {
          message.error(data.errorMessage || '授权失败，请重试');
        }
      }

      setStatus(nextState);
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || '查询会话状态失败';
      setStatus({ state: 'ERROR', accountType: null, expiresAt: null, error: errorMessage });
      if (showMessages) {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleAuthorize = async () => {
    if (!sessionId) {
      message.error('授权链接无效，请重新扫码');
      return;
    }

    setAuthorizing(true);
    try {
      await authorizeIcbcSession({ sessionId });
      message.success('授权成功，请返回电脑端继续');
      setStatus((prev) => ({ ...prev, state: 'AUTHORIZED' }));
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || '授权失败';
      message.error(errorMessage);
      setStatus((prev) => ({ ...prev, state: 'FAILED', error: errorMessage }));
    } finally {
      setAuthorizing(false);
    }
  };

  const renderContent = () => {
    if (!sessionId) {
      return (
        <Result
          status="error"
          title="链接无效"
          subTitle="未检测到有效的扫码登录会话，请返回电脑端重新生成二维码。"
        />
      );
    }

    switch (status.state) {
      case 'PENDING':
      case 'AUTHORIZED_PENDING':
        return (
          <Result
            status="info"
            title="确认登录授权"
            subTitle={`即将以${STATUS_LABELS[status.accountType] || '客户'}身份登录工银溯藏平台`}
            extra={[
              <Button key="authorize" type="primary" size="large" loading={authorizing} onClick={handleAuthorize} block>
                授权登录
              </Button>,
              <Button key="refresh" size="large" onClick={() => loadStatus(true)} block>
                刷新状态
              </Button>
            ]}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Paragraph>请确认手机端弹窗显示的信息无误后，点击“授权登录”。</Paragraph>
              {status.expiresAt && (
                <Text type="secondary">二维码有效期至：{new Date(status.expiresAt).toLocaleString()}</Text>
              )}
              <Text type="secondary" style={{ wordBreak: 'break-all' }}>会话ID：{sessionId}</Text>
            </Space>
          </Result>
        );
      case 'AUTHORIZED':
        return (
          <Result
            status="success"
            title="授权成功"
            subTitle="您的身份已确认，请返回电脑端继续操作。"
            extra={
              <Button type="primary" size="large" onClick={() => loadStatus(true)}>
                刷新状态
              </Button>
            }
          />
        );
      case 'EXPIRED':
        return (
          <Result
            status="warning"
            title="二维码已过期"
            subTitle="请返回电脑端重新生成登录二维码。"
            extra={
              <Button size="large" onClick={() => loadStatus(true)}>
                重新检查
              </Button>
            }
          />
        );
      case 'FAILED':
        return (
          <Result
            status="error"
            title="授权失败"
            subTitle={status.error || '授权过程中发生错误，请返回电脑端重新尝试。'}
            extra={
              <Button size="large" onClick={() => loadStatus(true)}>
                重试
              </Button>
            }
          />
        );
      case 'NOT_FOUND':
      case 'SESSION_NOT_FOUND':
        return (
          <Result
            status="error"
            title="会话不存在"
            subTitle="二维码会话不存在或已过期，请返回电脑端重新生成。"
            extra={
              <Button size="large" onClick={() => loadStatus(true)}>
                刷新
              </Button>
            }
          />
        );
      case 'ERROR':
        return (
          <Result
            status="error"
            title="发生错误"
            subTitle={status.error || '无法获取扫码会话，请稍后再试。'}
            extra={
              <Button size="large" onClick={() => loadStatus(true)}>
                重试
              </Button>
            }
          />
        );
      case 'MISSING_SESSION':
        return (
          <Result
            status="error"
            title="未识别会话"
            subTitle="请从电脑端重新发起扫码登录。"
          />
        );
      default:
        return (
          <Result
            status="info"
            title="正在获取授权信息"
            subTitle="请稍候，正在加载扫码会话详情。"
          />
        );
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Card style={{ maxWidth: 480, width: '100%' }} bordered={false}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={4}>工银溯藏平台登录授权</Title>
            <Paragraph type="secondary">请确认授权信息后完成登录</Paragraph>
          </div>
          {loading ? (
            <Spin tip="正在加载授权信息..." />
          ) : (
            renderContent()
          )}
        </Space>
      </Card>
    </div>
  );
};

export default IcbcAuthorize;
