import React, { useEffect, useMemo } from 'react';
import { Card, Col, Empty, List, Row, Tag, Typography, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  AppstoreOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  DeploymentUnitOutlined
} from '@ant-design/icons';
import { listCollectibles, listCollectibleApplications } from '../../services/collectibleService';
import { MetricCard } from '../../components/admin/MetricCard';

const { Title, Paragraph } = Typography;

const applicationStatusMeta = {
  PENDING_REVIEW: { text: '待审批', color: 'gold' },
  APPROVED: { text: '已通过', color: 'green' },
  REJECTED: { text: '已驳回', color: 'red' }
};

const buildCollectibleImageSrc = (collectible) => {
  if (!collectible) {
    return null;
  }

  const { productPhoto, productPhotoMimeType, metadata } = collectible;

  if (!productPhoto) {
    return null;
  }

  if (typeof productPhoto === 'string' && productPhoto.startsWith('data:')) {
    return productPhoto;
  }

  const mimeType = productPhotoMimeType || metadata?.productPhotoMimeType || 'image/png';
  return `data:${mimeType};base64,${productPhoto}`;
};

const Dashboard = () => {
  const {
    data: recent = { data: [], pagination: {} },
    isLoading: loadingRecent,
    isError: isRecentError,
    error: recentError
  } = useQuery({
    queryKey: ['collectibles', 'recent'],
    queryFn: () => listCollectibles({ limit: 5, page: 1 })
  });

  const {
    data: pendingApplications = { data: [], pagination: {} },
    isLoading: loadingApplicationPending,
    isError: isApplicationPendingError,
    error: applicationPendingError
  } = useQuery({
    queryKey: ['collectible-applications', 'pending-review'],
    queryFn: () => listCollectibleApplications({ status: 'PENDING_REVIEW', limit: 50 })
  });

  const {
    data: transferPending = { data: [], pagination: {} },
    isLoading: loadingTransfers,
    isError: isTransferError,
    error: transferError
  } = useQuery({
    queryKey: ['collectibles', 'transfer-pending'],
    queryFn: () => listCollectibles({ status: 'TRANSFER_PENDING', limit: 10 })
  });

  useEffect(() => {
    if (isRecentError) {
      message.error(recentError?.message || '最新藏品加载失败');
    }
  }, [isRecentError, recentError]);

  useEffect(() => {
    if (isTransferError) {
      message.error(transferError?.message || '转移队列加载失败');
    }
  }, [isTransferError, transferError]);

  useEffect(() => {
    if (isApplicationPendingError) {
      message.error(applicationPendingError?.message || '客户申请加载失败');
    }
  }, [isApplicationPendingError, applicationPendingError]);

  const stats = useMemo(() => {
    const total = recent.pagination.total || 0;
    const pendingApplicationCount = pendingApplications.pagination?.total || pendingApplications.data?.length || 0;
    const transferCount = transferPending.pagination.total || transferPending.data?.length || 0;
    const activeCount = Math.max(total - pendingApplicationCount, 0);
    return {
      total,
      transferCount,
      activeCount,
      pendingApplicationCount
    };
  }, [pendingApplications, recent.pagination, transferPending]);

  const buildApplicationImageSrc = (application) => {
    const attachments = application?.applicationData?.attachments;
    if (!Array.isArray(attachments)) {
      return null;
    }

    const imageAttachment = attachments.find((attachment) => {
      if (!attachment || !attachment.content) {
        return false;
      }
      if (typeof attachment.content === 'string' && attachment.content.startsWith('data:image/')) {
        return true;
      }
      return (attachment.type || '').startsWith('image/');
    });

    if (!imageAttachment) {
      return null;
    }

    if (typeof imageAttachment.content === 'string' && imageAttachment.content.startsWith('data:')) {
      return imageAttachment.content;
    }

    if ((imageAttachment.type || '').startsWith('image/')) {
      return `data:${imageAttachment.type};base64,${imageAttachment.content}`;
    }

    return null;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__title">
          <Title level={3}>区块链藏品运行总览</Title>
        </div>
        <Paragraph type="secondary">
          实时掌握藏品创建、审批、所有权转移的全链路状态。数据来自 Hyperledger Fabric 网络与 MySQL 同步表。
        </Paragraph>
      </div>
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title="链上藏品总数"
            value={stats.total}
            icon={<AppstoreOutlined style={{ fontSize: 24 }} />}
            footer={<Paragraph type="secondary">含所有在册藏品</Paragraph>}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title="待审批藏品"
            value={stats.pendingApplicationCount}
            icon={<AuditOutlined style={{ fontSize: 24 }} />}
            footer={<Paragraph type="secondary">审批通过后自动写入区块链</Paragraph>}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title="已上线藏品"
            value={stats.activeCount}
            icon={<CheckCircleOutlined style={{ fontSize: 24 }} />}
            footer={<Paragraph type="secondary">当前处于 ACTIVE 状态</Paragraph>}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title="待确认转移"
            value={stats.transferCount}
            icon={<DeploymentUnitOutlined style={{ fontSize: 24 }} />}
            footer={<Paragraph type="secondary">客户发起的所有权转移待审核</Paragraph>}
          />
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <Card title="最新上链藏品" variant="borderless" loading={loadingRecent}>
            {isRecentError ? (
              <Empty description="数据加载失败" />
            ) : recent.data.length ? (
              <List
                dataSource={recent.data}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={(() => {
                        const imageSrc = buildCollectibleImageSrc(item);
                        return imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={item.name}
                            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
                          />
                        ) : null;
                      })()}
                      title={`${item.name} · ${item.blockchain_id}`}
                      description={`哈希：${item.hash ? `${item.hash.slice(0, 12)}...` : '暂无'}`}
                    />
                    <Tag color="blue">{item.status || 'ACTIVE'}</Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无藏品" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={`待审批藏品 (${stats.pendingApplicationCount})`}
            variant="borderless"
            loading={loadingApplicationPending}
            extra={<a href="/admin/applications">进入审批中心</a>}
          >
            {isApplicationPendingError ? (
              <Empty description="数据加载失败" />
            ) : pendingApplications.data?.length ? (
              <List
                dataSource={pendingApplications.data.slice(0, 10)}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={(() => {
                        const imageSrc = buildApplicationImageSrc(item);
                        return imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={item.applicationData?.name || '客户申请'}
                            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
                          />
                        ) : null;
                      })()}
                      title={`${item.applicationData?.name || '未命名藏品'} · ${item.applicantName || item.applicantEmail || '未知申请人'}`}
                      description={`提交时间：${item.createdAt ? new Date(item.createdAt).toLocaleString() : '未知'} · 类型：${item.applicationData?.creationType === 'PERSONAL' ? '个人' : '企业'}`}
                    />
                    <Tag color={applicationStatusMeta[item.status]?.color || 'gold'}>
                      {applicationStatusMeta[item.status]?.text || item.status || '待审批'}
                    </Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无待审批申请" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card
            title={`待确认的所有权转移 (${stats.transferCount})`}
            variant="borderless"
            loading={loadingTransfers}
            extra={<a href="/admin/transfers">查看全部</a>}
          >
            {isTransferError ? (
              <Empty description="数据加载失败" />
            ) : transferPending.data.length ? (
              <List
                dataSource={transferPending.data}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={`${item.name} (${item.blockchain_id})`}
                      description={`发起人：${item.requested_by || '未知'} · 当前所有者：${item.current_owner_id || '待确认'}`}
                    />
                    <Tag color="orange">等待确认</Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无藏品" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
