import React, { useCallback, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Modal, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  listCollectibleApplications,
  updateCollectibleApplicationStatus
} from '../../services/collectibleService';

const statusMeta = {
  PENDING_REVIEW: { label: '待审批', color: 'gold' },
  APPROVED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已驳回', color: 'red' }
};

const statusTabs = [
  { key: 'PENDING_REVIEW', label: '待审批' },
  { key: 'APPROVED', label: '已通过' },
  { key: 'REJECTED', label: '已驳回' },
  { key: 'ALL', label: '全部申请' }
];

const ApplicationApprovals = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const {
    data: applicationPayload = { data: [], pagination: { total: 0, limit: 10, offset: 0 } },
    isLoading
  } = useQuery({
    queryKey: ['collectible-applications', statusFilter, pagination.current, pagination.pageSize],
    queryFn: () =>
      listCollectibleApplications({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize
      }),
    keepPreviousData: true
  });

  const { mutateAsync: mutateStatus, isLoading: updating } = useMutation({
    mutationFn: ({ id, status, notes }) => updateCollectibleApplicationStatus(id, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectible-applications'] });
      message.success('申请状态已更新');
    }
  });

  const handleApprove = useCallback(
    async (record) => {
      await mutateStatus({ id: record.id, status: 'APPROVED' });
    },
    [mutateStatus]
  );

  const handleReject = useCallback(
    async (record) => {
      let rejectReason = '';
      const confirmed = await new Promise((resolve) => {
        Modal.confirm({
          title: '驳回申请',
          content: (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="请输入驳回理由">
                <textarea
                  style={{ width: '100%', minHeight: 80 }}
                  onChange={(event) => {
                    rejectReason = event.target.value;
                  }}
                />
              </Descriptions.Item>
            </Descriptions>
          ),
          okText: '确定驳回',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });

      if (!confirmed) {
        return;
      }

      if (!rejectReason) {
        rejectReason = '未提供理由';
      }

      await mutateStatus({ id: record.id, status: 'REJECTED', notes: rejectReason });
    },
    [mutateStatus]
  );

  const showDetails = useCallback((record) => {
    const { applicationData = {}, status, createdAt, notes } = record;
    const enterpriseInfo = applicationData.enterpriseInfo || {};
    const personalInfo = applicationData.personalInfo || {};
    const attachments = applicationData.attachments || [];

    Modal.info({
      title: `${applicationData.name || '未命名藏品'} · 申请详情`,
      width: 720,
      icon: null,
      okText: '关闭',
      content: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="申请编号">{record.id}</Descriptions.Item>
            <Descriptions.Item label="提交时间">
              {createdAt ? dayjs(createdAt).format('YYYY-MM-DD HH:mm:ss') : '未知'}
            </Descriptions.Item>
            <Descriptions.Item label="申请人">{record.applicantName || '未知用户'}</Descriptions.Item>
            <Descriptions.Item label="申请人邮箱">{record.applicantEmail || '未提供'}</Descriptions.Item>
            <Descriptions.Item label="当前状态" span={2}>
              <Tag color={statusMeta[status]?.color || 'default'}>{statusMeta[status]?.label || status}</Tag>
            </Descriptions.Item>
            {notes ? (
              <Descriptions.Item label="备注" span={2}>
                {notes}
              </Descriptions.Item>
            ) : null}
          </Descriptions>

          <Descriptions column={2} title="创作主体" bordered size="small">
            <Descriptions.Item label="类型">
              {applicationData.creationType === 'PERSONAL' ? '个人创作' : '企业创作'}
            </Descriptions.Item>
            <Descriptions.Item label="预估价值">{applicationData.estimatedValue || 0}</Descriptions.Item>
            {applicationData.creationType === 'ENTERPRISE' ? (
              <>
                <Descriptions.Item label="企业名称">{enterpriseInfo.companyName || '未填写'}</Descriptions.Item>
                <Descriptions.Item label="企业注册号">{enterpriseInfo.registrationNumber || '未填写'}</Descriptions.Item>
              </>
            ) : (
              <>
                <Descriptions.Item label="创作平台">{personalInfo.platform || '未填写'}</Descriptions.Item>
                <Descriptions.Item label="平台账号">{personalInfo.platformId || '未填写'}</Descriptions.Item>
                <Descriptions.Item label="创作者姓名" span={2}>{personalInfo.personalName || '未填写'}</Descriptions.Item>
              </>
            )}
          </Descriptions>

          <Descriptions column={1} title="藏品信息" bordered size="small">
            <Descriptions.Item label="名称">{applicationData.name || '未命名藏品'}</Descriptions.Item>
            <Descriptions.Item label="类型">{applicationData.collectibleType || '未分类'}</Descriptions.Item>
            <Descriptions.Item label="发布日期">{applicationData.publishDate || '未设置'}</Descriptions.Item>
            <Descriptions.Item label="描述">{applicationData.description || '暂无描述'}</Descriptions.Item>
          </Descriptions>

          {attachments.length ? (
            <Card title={`附件 (${attachments.length})`} size="small" type="inner" bordered={false}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {attachments.map((item, index) => (
                  <a key={item.uid || index} href={item.content} download={item.name} target="_blank" rel="noreferrer">
                    {item.name || `附件 ${index + 1}`}
                  </a>
                ))}
              </Space>
            </Card>
          ) : null}
        </Space>
      )
    });
  }, []);

  const tableColumns = useMemo(
    () => [
      {
        title: '申请编号',
        dataIndex: 'id',
        width: 120
      },
      {
        title: '藏品名称',
        dataIndex: ['applicationData', 'name'],
        render: (value) => value || '未命名藏品'
      },
      {
        title: '申请人',
        dataIndex: 'applicantName',
        render: (value, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{value || '未知用户'}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.applicantEmail || '未提供邮箱'}
            </Typography.Text>
          </Space>
        )
      },
      {
        title: '创作类型',
        dataIndex: ['applicationData', 'creationType'],
        render: (value) => (value === 'PERSONAL' ? '个人创作' : '企业创作'),
        width: 120
      },
      {
        title: '提交时间',
        dataIndex: 'createdAt',
        render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未知')
      },
      {
        title: '状态',
        dataIndex: 'status',
        render: (value) => <Tag color={statusMeta[value]?.color || 'default'}>{statusMeta[value]?.label || value}</Tag>,
        width: 120
      },
      {
        title: '链上藏品',
        dataIndex: 'linkedCollectibleId',
        render: (value) => (value ? <Tag color="blue">{value}</Tag> : <Typography.Text type="secondary">未生成</Typography.Text>),
        width: 200
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 220,
        render: (_, record) => (
          <Space>
            <Button icon={<EyeOutlined />} onClick={() => showDetails(record)}>
              详情
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={record.status !== 'PENDING_REVIEW'}
              loading={updating}
              onClick={() => handleApprove(record)}
            >
              通过
            </Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              disabled={record.status !== 'PENDING_REVIEW'}
              loading={updating}
              onClick={() => handleReject(record)}
            >
              驳回
            </Button>
          </Space>
        )
      }
    ],
    [handleApprove, handleReject, showDetails, updating]
  );

  const handleTableChange = useCallback((nextPagination) => {
    setPagination({ current: nextPagination.current, pageSize: nextPagination.pageSize });
  }, []);

  const handleTabChange = useCallback((key) => {
    setStatusFilter(key);
    setPagination({ current: 1, pageSize: pagination.pageSize });
  }, [pagination.pageSize]);

  const dataSource = applicationPayload.data || [];
  const total = applicationPayload.pagination?.total || dataSource.length;

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3}>客户藏品申请审批</Typography.Title>
        <Typography.Paragraph type="secondary">
          管理企业与个人客户提交的藏品申请，审批通过后由平台团队创建并上链。
        </Typography.Paragraph>
      </div>
      <Card variant="borderless">
        <Tabs
          activeKey={statusFilter}
          items={statusTabs}
          onChange={handleTabChange}
          style={{ marginBottom: 16 }}
        />
        <Table
          rowKey="id"
          loading={isLoading}
          columns={tableColumns}
          dataSource={dataSource}
          onChange={handleTableChange}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20']
          }}
        />
      </Card>
    </div>
  );
};

export default ApplicationApprovals;
