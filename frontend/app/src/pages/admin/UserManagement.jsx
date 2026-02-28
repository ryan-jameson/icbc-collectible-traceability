import React, { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createUser, deactivateUser, listUsers } from '../../services/userService';

const accountTypeTabs = [
  { key: 'PERSONAL', label: '个人用户' },
  { key: 'ENTERPRISE', label: '企业用户' }
];

const statusMeta = {
  ACTIVE: { text: '启用', color: 'green' },
  INACTIVE: { text: '停用', color: 'default' },
  SUSPENDED: { text: '冻结', color: 'orange' },
  BLOCKED: { text: '封禁', color: 'red' }
};

const roleLabelMap = {
  USER: '普通用户',
  CUSTOMER: '客户',
  CLIENT: '客户',
  BRAND_CLIENT: '品牌客户',
  ENTERPRISE_CLIENT: '企业客户',
  PERSONAL_CLIENT: '个人客户',
  BRAND_ADMIN: '品牌管理员',
  ICBC_ADMIN: '工行管理员',
  SUPER_ADMIN: '平台管理员'
};

const UserManagement = () => {
  const [activeAccountType, setActiveAccountType] = useState('PERSONAL');
  const [searchValue, setSearchValue] = useState('');
  const [queryKeyword, setQueryKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', activeAccountType, page, pageSize, queryKeyword],
    queryFn: () =>
      listUsers({
        accountType: activeAccountType,
        page,
        limit: pageSize,
        search: queryKeyword || undefined
      }),
    keepPreviousData: true
  });

  const users = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 10, pages: 1 };

  const refreshList = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (response) => {
      const { data: createdUser, initialPassword } = response;
      message.success('用户创建成功');
      refreshList();
      setCreateModalOpen(false);
      form.resetFields();

      Modal.success({
        title: '初始登录信息',
        content: (
          <Space direction="vertical" size="small">
            <Typography.Text>请妥善保管以下信息并及时通知用户：</Typography.Text>
            <div>
              <Typography.Text strong>账号：</Typography.Text>
              <Typography.Text style={{ marginLeft: 8 }}>{createdUser?.email}</Typography.Text>
            </div>
            <div>
              <Typography.Text strong>初始密码：</Typography.Text>
              <Typography.Text code style={{ marginLeft: 8 }}>{initialPassword}</Typography.Text>
            </div>
          </Space>
        )
      });
    },
    onError: (error) => {
      message.error(error.message || '创建用户失败');
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      message.success('用户已停用，并回收名下藏品');
      refreshList();
    },
    onError: (error) => {
      message.error(error.message || '停用用户失败');
    }
  });

  const handleTabChange = useCallback((tabKey) => {
    setActiveAccountType(tabKey);
    setPage(1);
    setSearchValue('');
    setQueryKeyword('');
  }, []);

  const handleSearch = useCallback((value) => {
    setSearchValue(value);
    setQueryKeyword(value.trim());
    setPage(1);
  }, []);

  const handleTableChange = useCallback((paginationConfig) => {
    setPage(paginationConfig.current);
    setPageSize(paginationConfig.pageSize);
  }, []);

  const openCreateModal = () => {
    setCreateModalOpen(true);
    form.setFieldsValue({ accountType: activeAccountType });
  };

  const handleCreateUser = () => {
    form
      .validateFields()
      .then((values) => {
        createMutation.mutate({
          name: values.name,
          email: values.email,
          phone: values.phone || undefined,
          accountType: values.accountType
        });
      })
      .catch(() => {});
  };

  const confirmDeactivate = useCallback(
    (userId) => {
      deactivateMutation.mutate(userId);
    },
    [deactivateMutation]
  );

  const columns = useMemo(() => {
    return [
      {
        title: '用户ID',
        dataIndex: 'id',
        key: 'id',
        width: 120,
        render: (value) => (
          <Typography.Text code style={{ userSelect: 'all' }}>
            {value}
          </Typography.Text>
        )
      },
      {
        title: '姓名',
        dataIndex: 'name',
        key: 'name',
        render: (value, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{value || '未填写'}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Typography.Text>
          </Space>
        )
      },
      {
        title: '手机号',
        dataIndex: 'phone',
        key: 'phone',
        render: (value) => value || '—'
      },
      {
        title: '角色',
        dataIndex: 'role',
        key: 'role',
        render: (value) => roleLabelMap[value] || value || '—'
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (value) => {
          const meta = statusMeta[value] || { text: value || '未知', color: 'default' };
          return <Tag color={meta.color}>{meta.text}</Tag>;
        }
      },
      {
        title: '最近登录',
        dataIndex: 'lastLogin',
        key: 'lastLogin',
        render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '从未登录')
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—')
      },
      {
        title: '操作',
        key: 'actions',
        render: (_, record) => (
          <Space>
            <Popconfirm
              title="确认停用该用户?"
              description="停用后将回收该用户的所有藏品，操作不可逆。"
              okText="确认停用"
              cancelText="取消"
              okButtonProps={{ loading: deactivateMutation.isLoading, danger: true }}
              onConfirm={() => confirmDeactivate(record.id)}
              disabled={record.status !== 'ACTIVE'}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<StopOutlined />}
                disabled={record.status !== 'ACTIVE'}
              >
                停用
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ];
  }, [confirmDeactivate, deactivateMutation.isLoading]);

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3}>用户生命周期管理</Typography.Title>
        <Typography.Paragraph type="secondary">
          区分个人与企业账户，支持新增用户、停用并回收相关藏品。所有改动会被实时记录并与区块链数据保持一致。
        </Typography.Paragraph>
      </div>

      <Card variant="borderless">
        <Tabs
          activeKey={activeAccountType}
          onChange={handleTabChange}
          items={accountTypeTabs.map((tab) => ({
            key: tab.key,
            label: (
              <Space>
                {tab.label}
                <Badge
                  count={tab.key === activeAccountType ? pagination.total : undefined}
                  size="small"
                  style={{ backgroundColor: '#1890ff' }}
                  showZero
                />
              </Space>
            ),
            children: null
          }))}
        />

        <Divider style={{ margin: '12px 0 24px' }} />

        <Space style={{ width: '100%', marginBottom: 16 }} align="center" wrap>
          <Input.Search
            allowClear
            placeholder="按姓名 / 邮箱 / 手机号搜索"
            style={{ maxWidth: 320 }}
            value={searchValue}
            onSearch={handleSearch}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={refreshList} disabled={isLoading}>
            刷新
          </Button>
          <Space style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增用户
            </Button>
          </Space>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={isLoading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 位用户`,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (current, size) => handleTableChange({ current, pageSize: size }),
            onShowSizeChange: (current, size) => handleTableChange({ current, pageSize: size })
          }}
          onChange={(tablePagination) => handleTableChange(tablePagination)}
          locale={{ emptyText: queryKeyword ? '没有匹配的用户' : '暂无用户' }}
        />
      </Card>

      <Modal
        title="新增用户"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={handleCreateUser}
        confirmLoading={createMutation.isLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={form} initialValues={{ accountType: activeAccountType }}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入用户姓名' }]}
          >
            <Input placeholder="请输入用户姓名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入用户邮箱' },
              { type: 'email', message: '邮箱格式不正确' }
            ]}
          >
            <Input placeholder="例如：user@example.com" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="可选，便于联系" />
          </Form.Item>
          <Form.Item
            name="accountType"
            label="账户类型"
            rules={[{ required: true, message: '请选择账户类型' }]}
          >
            <Select
              options={accountTypeTabs.map((tab) => ({ value: tab.key, label: tab.label }))}
              onChange={(value) => {
                if (value !== activeAccountType) {
                  setActiveAccountType(value);
                  setPage(1);
                  setSearchValue('');
                  setQueryKeyword('');
                }
              }}
            />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            创建后系统将生成随机初始密码，仅显示一次，请及时记录并发送给用户。
          </Typography.Paragraph>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
