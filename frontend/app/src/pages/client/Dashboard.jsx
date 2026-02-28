import React, { useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Result, Row, Statistic, Typography, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUserCollectibles } from '../../services/userService';
import { getMyCollectibleApplications, verifyCollectible } from '../../services/collectibleService';
import { buildCollectibleImageSrc } from '../../utils/collectibleImage';

const { Title, Paragraph } = Typography;

const Dashboard = () => {
  const [verificationResult, setVerificationResult] = useState(null);
  const { data = { data: [], pagination: {} }, isLoading } = useQuery({
    queryKey: ['me', 'collectibles', { limit: 5 }],
    queryFn: () => getCurrentUserCollectibles({ limit: 5 })
  });

  const { data: myApplications = [], isLoading: loadingApplications } = useQuery({
    queryKey: ['me', 'collectible-applications'],
    queryFn: () => getMyCollectibleApplications()
  });

  const stats = useMemo(() => {
    const total = data.pagination?.total || data.data?.length || 0;
    const active = data.data?.filter((item) => item.status === 'ACTIVE').length || 0;
    const pendingCollectibles = data.data?.filter((item) => item.status !== 'ACTIVE').length || 0;
    const pendingApplications = myApplications.filter((item) => item.status === 'PENDING_REVIEW').length;
    return {
      total,
      active,
      pending: pendingCollectibles + pendingApplications,
      pendingApplications
    };
  }, [data, myApplications]);

  const handleVerify = async (values) => {
    try {
      const res = await verifyCollectible(values);
      setVerificationResult(res);
    } catch (error) {
      message.error(error.message || '验证失败');
    }
  };

  return (
    <div>
      <div className="page-header">
        <Title level={3}>我的数字藏品概览</Title>
        <Paragraph type="secondary">查看您在区块链上的藏品资产，并快速验证藏品真伪。</Paragraph>
      </div>
      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card variant="borderless" loading={isLoading}>
            <Statistic title="藏品总数" value={stats.total} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless" loading={isLoading}>
            <Statistic title="已上链" value={stats.active} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless" loading={isLoading || loadingApplications}>
            <Statistic
              title="处理中"
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
              suffix={stats.pendingApplications ? `（含 ${stats.pendingApplications} 条待审批申请）` : undefined}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} xl={12}>
          <Card title="快速真伪验证" variant="borderless">
            <Form layout="vertical" onFinish={handleVerify}>
              <Form.Item
                label="藏品 ID"
                name="id"
                rules={[{ required: true, message: '请输入藏品 ID' }]}
              >
                <Input placeholder="请输入链上藏品编号" />
              </Form.Item>
              <Form.Item
                label="藏品哈希"
                name="hash"
                rules={[{ required: true, message: '请输入藏品哈希' }]}
              >
                <Input placeholder="可通过二维码或区块链浏览器获取" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">立即验证</Button>
              </Form.Item>
            </Form>
            {verificationResult && (
              <Result
                status={verificationResult.isAuthentic ? 'success' : 'error'}
                title={verificationResult.isAuthentic ? '藏品验证为真' : '未通过真伪验证'}
                subTitle={verificationResult.isAuthentic ? '链上哈希与输入哈希一致。' : '链上哈希与输入哈希不匹配，请核实信息。'}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="最近更新" variant="borderless" loading={isLoading}>
            {data.data?.length ? (
              data.data.slice(0, 5).map((item) => {
                const imageSrc = buildCollectibleImageSrc(item);
                return (
                  <div
                    key={item.blockchain_id || item.id}
                    style={{
                      display: 'flex',
                      gap: 16,
                      marginBottom: 16,
                      alignItems: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        background: '#f5f5f5',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={item.name || '藏品图片'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : null}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Title level={5} style={{ marginBottom: 0 }}>{item.name || '未命名藏品'}</Title>
                      <Paragraph type="secondary" style={{ marginBottom: 4 }}>
                        藏品编号：{item.blockchain_id || '--'}
                      </Paragraph>
                      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        状态：{item.status || '未知'}
                      </Paragraph>
                    </div>
                  </div>
                );
              })
            ) : (
              <Paragraph type="secondary">暂无更新记录</Paragraph>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="我的申请进度" variant="borderless" loading={loadingApplications}>
            {myApplications.length ? (
              myApplications.slice(0, 5).map((item) => (
                <div key={item.id} style={{ marginBottom: 16 }}>
                  <Title level={5} style={{ marginBottom: 0 }}>{item.applicationData?.name || '未命名藏品'}</Title>
                  <Paragraph type="secondary" style={{ marginBottom: 4 }}>
                    状态：{item.status}
                  </Paragraph>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    提交时间：{item.createdAt ? new Date(item.createdAt).toLocaleString() : '未知'}
                  </Paragraph>
                </div>
              ))
            ) : (
              <Paragraph type="secondary">暂无申请记录</Paragraph>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
