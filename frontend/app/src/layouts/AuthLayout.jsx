import React from 'react';
import PropTypes from 'prop-types';
import { Layout, Typography } from 'antd';
import './AuthLayout.css';

const { Content, Footer } = Layout;

const AuthLayout = ({ children }) => {
  return (
    <Layout className="auth-layout">
      <Content className="auth-layout__content">
        <div className="auth-layout__panel">
          <div className="auth-layout__brand">
            <img src="https://img.icons8.com/ios-filled/100/0052d9/blockchain-technology.png" alt="ICBC Collectible" />
            <Typography.Title level={3}>工银溯藏数字藏品平台</Typography.Title>
            <Typography.Paragraph type="secondary">
              可信区块链赋能藏品数字身份，全流程溯源与审批在此完成。
            </Typography.Paragraph>
          </div>
          {children}
        </div>
      </Content>
      <Footer className="auth-layout__footer">© {new Date().getFullYear()} 中国工商银行 · 数字藏品实验室</Footer>
    </Layout>
  );
};

export default AuthLayout;

AuthLayout.propTypes = {
  children: PropTypes.node.isRequired
};
