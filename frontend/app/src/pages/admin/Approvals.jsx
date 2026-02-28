import React, { useCallback, useMemo } from 'react';
import { Button, Card, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { listCollectibles, updateCollectibleStatus } from '../../services/collectibleService';

const statusLabels = {
  PENDING_REVIEW: { text: '待审批', color: 'gold' },
  ACTIVE: { text: '已上线', color: 'blue' },
  REJECTED: { text: '已驳回', color: 'red' }
};

const Approvals = () => {
  const queryClient = useQueryClient();
  const { data = { data: [], pagination: {} }, isLoading } = useQuery({
    queryKey: ['collectibles', 'pending-review'],
    queryFn: () => listCollectibles({ status: 'PENDING_REVIEW', limit: 50 })
  });

  const { mutateAsync: mutateStatus, isLoading: isUpdating } = useMutation({
    mutationFn: ({ id, status }) => updateCollectibleStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectibles', 'pending-review'] });
      queryClient.invalidateQueries({ queryKey: ['collectibles', 'recent'] });
    }
  });

  const handleApprove = useCallback(async (record) => {
    try {
      await mutateStatus({ id: record.blockchain_id || record.id, status: 'ACTIVE' });
      message.success('已通过审批，链码将自动写入藏品信息');
    } catch (error) {
      message.error(error.message || '审批失败');
    }
  }, [mutateStatus]);

  const handleReject = useCallback(async (record) => {
    const reason = await new Promise((resolve) => {
      let rejectReason = '';
      Modal.confirm({
        title: '驳回藏品申请',
        content: (
          <Input.TextArea
            placeholder="请输入驳回理由"
            autoSize={{ minRows: 3 }}
            onChange={(event) => {
              rejectReason = event.target.value;
            }}
          />
        ),
        onOk: () => resolve(rejectReason || '未提供理由'),
        onCancel: () => resolve(null)
      });
    });

    if (!reason) {
      return;
    }

    try {
      await mutateStatus({ id: record.blockchain_id || record.id, status: 'REJECTED', reason });
      message.success('已驳回该藏品');
    } catch (error) {
      message.error(error.message || '驳回失败');
    }
  }, [mutateStatus]);

  const showCollectible = useCallback((record) => {
    Modal.info({
      title: `藏品详情 · ${record.name}`,
      width: 640,
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>藏品编号：{record.blockchain_id}</Typography.Text>
          <Typography.Text>品牌：{record.brand_name || '未知'}</Typography.Text>
          <Typography.Text>材质：{record.material || '未知'}</Typography.Text>
          <Typography.Text>批次号：{record.batch_number}</Typography.Text>
          <Typography.Text>设计师：{record.designer}</Typography.Text>
          <Typography.Paragraph>描述：{record.description || '无'}</Typography.Paragraph>
        </Space>
      )
    });
  }, []);

  const columns = useMemo(() => [
    {
      title: '藏品 ID',
      dataIndex: 'blockchain_id'
    },
    {
      title: '名称',
      dataIndex: 'name'
    },
    {
      title: '品牌',
      dataIndex: 'brand_name',
      render: (value) => value || '未知品牌'
    },
    {
      title: '提交人',
      dataIndex: 'created_by_id'
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      render: (value) => {
        const meta = statusLabels[value] || { text: value, color: 'default' };
        return <Tag color={meta.color}>{meta.text}</Tag>;
      }
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => showCollectible(record)}>详情</Button>
          <Button type="primary" icon={<CheckCircleOutlined />} loading={isUpdating} onClick={() => handleApprove(record)}>
            通过
          </Button>
          <Button danger icon={<CloseCircleOutlined />} loading={isUpdating} onClick={() => handleReject(record)}>
            驳回
          </Button>
        </Space>
      )
    }
  ], [handleApprove, handleReject, isUpdating, showCollectible]);

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3}>藏品审批中心</Typography.Title>
        <Typography.Paragraph type="secondary">
          审核通过后系统会自动执行链码 `createCollectible`，并回写 MySQL 状态。驳回将保留链下记录。
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
            showTotal: (total) => `共 ${total} 条待审批记录`
          }}
        />
      </Card>
    </div>
  );
};

export default Approvals;
