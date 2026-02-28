import React, { useMemo } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Tag } from 'antd';
import {
  AppstoreOutlined,
  IdcardOutlined,
  PlusSquareOutlined,
  QrcodeOutlined,
  SwapOutlined
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const { Header, Content } = Layout;

const ClientLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = useMemo(() => [
    {
      key: '/client',
      icon: <AppstoreOutlined />,
      label: <Link to="/client">我的控制台</Link>
    },
    {
      key: '/client/apply',
      icon: <QrcodeOutlined />,
      label: <Link to="/client/apply">藏品认领</Link>
    },
    {
      key: '/client/applications/new',
      icon: <PlusSquareOutlined />,
      label: <Link to="/client/applications/new">申请新藏品</Link>
    },
    {
      key: '/client/my-collectibles',
      icon: <IdcardOutlined />,
      label: <Link to="/client/my-collectibles">我的藏品</Link>
    },
    {
      key: '/client/transfer',
      icon: <SwapOutlined />,
      label: <Link to="/client/transfer">藏品转移</Link>
    }
  ], []);

  const profileMenu = {
    items: [
      {
        key: 'logout',
        label: '退出登录',
        onClick: async () => {
          await logout();
          navigate('/login');
        }
      }
    ]
  };

  const displayName = user?.name || user?.email || '访客';
  const displayId = user?.id ?? null;
  const displayNameWithId = displayId ? `${displayName} (#${displayId})` : displayName;
  const displayInitial = displayName?.charAt(0)?.toUpperCase() || 'U';
  const accountTypeTag = user?.accountType === 'ENTERPRISE' ? '企业用户' : '个人用户';

  return (
    <Layout>
          <Header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fff',
              borderBottom: '1px solid #f0f0f0',
              padding: '12px 24px',
              height: 'auto',
              lineHeight: 'normal'
            }}
          >
            <Space size={16} align="center" wrap>
          <img src="/logo.png" alt="logo" width={32} height={32} style={{ objectFit: 'contain' }} />
          <div>
            <Typography.Text strong style={{ fontSize: 18, lineHeight: 1.4, display: 'block' }}>
              工银溯藏客户门户
            </Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', lineHeight: 1.4 }}>
              基于区块链的藏品可信身份 & 资产管理
            </Typography.Text>
          </div>
        </Space>
        <Space size={16}>
          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname.startsWith('/client') ? location.pathname : '/client']}
            items={menuItems}
          />
          <Dropdown menu={profileMenu} placement="bottomRight" trigger={["click"]}>
            <Space style={{ cursor: 'pointer' }} align="center" size={12}>
              <Avatar style={{ background: '#0052d9' }}>{displayInitial}</Avatar>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <Typography.Text strong ellipsis={{ tooltip: displayNameWithId }} style={{ maxWidth: 200 }}>
                  {displayName}
                  {displayId ? ` (#${displayId})` : ''}
                </Typography.Text>
                <Tag color="green" style={{ marginInline: 0 }}>{accountTypeTag}</Tag>
              </div>
            </Space>
          </Dropdown>
        </Space>
      </Header>
      <Content style={{ padding: '24px', minHeight: 'calc(100vh - 64px)' }}>
        <Outlet />
      </Content>
    </Layout>
  );
};

export default ClientLayout;
