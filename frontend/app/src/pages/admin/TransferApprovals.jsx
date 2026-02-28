import React from 'react';
import { Button, Card, Space, Table, Tag, Typography, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCollectibles, transferCollectible, updateCollectibleStatus } from '../../services/collectibleService';

const TransferApprovals = () => {
  const queryClient = useQueryClient();
  const { data = { data: [], pagination: {} }, isLoading } = useQuery({
    queryKey: ['collectibles', 'transfer-requests'],
    queryFn: () => listCollectibles({ status: 'TRANSFER_PENDING', limit: 50 })
  });

  const { mutateAsync: confirmTransfer, isLoading: confirming } = useMutation({
    mutationFn: ({ id, newOwnerId }) => transferCollectible(id, { newOwnerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectibles', 'transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['collectibles', 'transfer-pending'] });
    }
  });

  const { mutateAsync: rejectTransfer, isLoading: rejecting } = useMutation({
    mutationFn: ({ id }) => updateCollectibleStatus(id, 'ACTIVE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectibles', 'transfer-requests'] });
    }
  });

  const handleConfirm = async (record) => {
    try {
  const blockchainId = record.blockchainId || record.blockchain_id || record.id;
  const newOwnerId = record.transferRequest?.newOwnerId || record.transfer_request?.newOwnerId;
      if (!blockchainId || !newOwnerId) {
        message.error('无法确认转移：缺少藏品编号或受让人信息');
        return;
      }
  await confirmTransfer({ id: blockchainId, newOwnerId });
      message.success('已确认所有权转移');
    } catch (error) {
      message.error(error.message || '确认失败');
    }
  };

  const handleReject = async (record) => {
    try {
  const blockchainId = record.blockchainId || record.blockchain_id || record.id;
      if (!blockchainId) {
        message.error('无法拒绝：缺少藏品编号');
        return;
      }
  await rejectTransfer({ id: blockchainId });
      message.success('已拒绝转移申请');
    } catch (error) {
      message.error(error.message || '拒绝失败');
    }
  };

  const columns = [
    { title: '藏品 ID', dataIndex: 'blockchainId', render: (_, record) => record.blockchainId || record.blockchain_id || '--' },
    { title: '藏品名称', dataIndex: 'name' },
    {
      title: '当前所有者',
      dataIndex: 'currentOwnerId',
      render: (_, record) => {
        const ownerId = record.currentOwnerId || record.current_owner_id;
        if (ownerId) {
          return ownerId;
        }
        return record.brandName || record.brand_name || '品牌方';
      }
    },
    {
      title: '申请转移至',
      dataIndex: 'transferRequest',
      render: (_, record) => {
        const request = record.transferRequest || record.transfer_request;
        if (!request) {
          return '未知用户';
        }
        return (
          <div>
            <div>{request.newOwnerName || request.newOwnerId || '未知用户'}</div>
            {request.newOwnerEmail && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {request.newOwnerEmail}
              </Typography.Text>
            )}
            <div style={{ marginTop: 8 }}>
              <Tag color={request.accountType === 'ENTERPRISE' ? 'blue' : 'green'}>
                {request.accountType === 'ENTERPRISE' ? '企业资质' : '个人资质'}
              </Tag>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                {request.accountType === 'ENTERPRISE' ? (
                  <>
                    <div>企业注册号：{request.enterpriseInfo?.registrationNumber || '—'}</div>
                    <div>企业名称：{request.enterpriseInfo?.companyName || '—'}</div>
                  </>
                ) : (
                  <>
                    <div>创作者平台：{request.personalInfo?.platform || '—'}</div>
                    <div>平台ID：{request.personalInfo?.platformId || '—'}</div>
                    <div>创作者姓名：{request.personalInfo?.personalName || '—'}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      title: '申请时间',
      dataIndex: 'transferRequest',
      render: (_, record) => {
        const request = record.transferRequest || record.transfer_request;
        const value = request?.requestedAt;
        return value ? new Date(value).toLocaleString() : '未知';
      }
    },
    {
      title: '申请类型',
      dataIndex: 'transferRequestType',
      render: (_, record) => {
        const request = record.transferRequest || record.transfer_request;
        if (!request) {
          return '--';
        }
        return request.type === 'CLAIM' ? '认领申请' : '所有权转移';
      }
    },
    {
      title: '补充说明',
      dataIndex: 'note',
      render: (_, record) => {
        const request = record.transferRequest || record.transfer_request;
        if (!request?.note) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }
        return (
          <Typography.Text style={{ maxWidth: 260 }} ellipsis={{ tooltip: request.note }}>
            {request.note}
          </Typography.Text>
        );
      }
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button type="primary" icon={<CheckOutlined />} loading={confirming} onClick={() => handleConfirm(record)}>
            确认转移
          </Button>
          <Button danger icon={<CloseOutlined />} loading={rejecting} onClick={() => handleReject(record)}>
            拒绝
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3}>所有权转移确认</Typography.Title>
        <Typography.Paragraph type="secondary">
          审核客户发起的藏品流转申请，确认无误后将调用链码转移所有权并记录历史。
        </Typography.Paragraph>
      </div>
  <Card variant="borderless">
        <Table
          rowKey={(record) => record.blockchain_id || record.id}
          loading={isLoading}
          columns={columns}
          dataSource={data.data}
          pagination={{
            total: data.pagination.total,
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条转移申请`
          }}
          locale={{ emptyText: '当前暂无待确认的转移申请' }}
        />
      </Card>
    </div>
  );
};

export default TransferApprovals;
