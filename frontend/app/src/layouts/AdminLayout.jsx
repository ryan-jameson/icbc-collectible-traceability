import React, { useCallback, useMemo } from 'react';
import { Layout, Menu, Avatar, Typography, Space, Tag, Modal } from 'antd';
import {
  AppstoreOutlined,
  AuditOutlined,
  DeploymentUnitOutlined,
  PlusCircleOutlined,
  SearchOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const { Header, Sider, Content } = Layout;

const roleLabels = {
  SUPER_ADMIN: '超级管理员',
  ICBC_ADMIN: '工行管理员',
  BRAND_ADMIN: '品牌管理员'
};

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleAvatarClick = useCallback(() => {
    Modal.confirm({
      title: '确认要退出登录吗？',
      content: '退出后需要重新登录才能继续访问后台。',
      okText: '退出登录',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await logout();
        navigate('/login');
      }
    });
  }, [logout, navigate]);

  const menuItems = useMemo(() => {
    const items = [
      {
        key: '/admin',
        icon: <AppstoreOutlined />,
        label: <Link to="/admin">数据概览</Link>
      },
      {
        key: '/admin/create',
        icon: <PlusCircleOutlined />,
        label: <Link to="/admin/create">创建藏品</Link>
      }
    ];

    if (user?.role === 'SUPER_ADMIN' || user?.role === 'ICBC_ADMIN') {
      items.push({
        key: '/admin/applications',
        icon: <AuditOutlined />,
        label: <Link to="/admin/applications">客户申请审批</Link>
      });
      items.push({
        key: '/admin/search',
        icon: <SearchOutlined />,
        label: <Link to="/admin/search">搜索链上藏品</Link>
      });
    }

    items.push({
      key: '/admin/transfers',
      icon: <DeploymentUnitOutlined />,
      label: <Link to="/admin/transfers">所有权转移确认</Link>
    });

    if (user?.role === 'SUPER_ADMIN' || user?.role === 'ICBC_ADMIN') {
      items.push({
        key: '/admin/users',
        icon: <TeamOutlined />,
        label: <Link to="/admin/users">用户与品牌</Link>
      });
    }

    return items;
  }, [user?.role]);

  const displayName = user?.name || user?.email || '访客';
  const displayId = user?.id ?? null;
  const displayNameWithId = displayId ? `${displayName} (#${displayId})` : displayName;
  const displayInitial = displayName?.charAt(0)?.toUpperCase() || 'U';
  const displayTag = roleLabels[user?.role] || user?.role || '访客';
  return (
    <Layout hasSider>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '20px 16px',
            color: '#fff'
          }}
        >
          <img src="/logo.png" alt="logo" width={32} height={32} style={{ objectFit: 'contain' }} />
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            管理员控制台
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname.startsWith('/admin') ? location.pathname : '/admin']}
          mode="inline"
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            工银溯藏治理后台
          </Typography.Title>
          <Space
            style={{ cursor: 'pointer' }}
            align="center"
            size={12}
            onClick={handleAvatarClick}
          >
            <Avatar style={{ backgroundColor: '#0052d9' }}>{displayInitial}</Avatar>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <Typography.Text strong ellipsis={{ tooltip: displayNameWithId }} style={{ maxWidth: 200 }}>
                {displayName}
                {displayId ? ` (#${displayId})` : ''}
              </Typography.Text>
              <Tag color="blue" style={{ marginInline: 0 }}>{displayTag}</Tag>
            </div>
          </Space>
        </Header>
        <Content style={{ margin: '24px', minHeight: 'calc(100vh - 160px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
