import React, { useState } from 'react';
import { Card, Form, Input, Select, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { listCollectibles } from '../../services/collectibleService';

const statusOptions = [
  { label: '全部', value: undefined },
  { label: '待审批', value: 'PENDING_REVIEW' },
  { label: '已上线', value: 'ACTIVE' },
  { label: '转移中', value: 'TRANSFER_PENDING' }
];

const columns = [
  { title: '藏品编号', dataIndex: 'blockchain_id' },
  { title: '藏品名称', dataIndex: 'name' },
  { title: '品牌', dataIndex: 'brand_name' },
  {
    title: '状态',
    dataIndex: 'status',
    render: (status) => <Tag color={status === 'ACTIVE' ? 'blue' : 'gold'}>{status}</Tag>
  }
];

const SearchCollectibles = () => {
  const [filters, setFilters] = useState({ keyword: '', status: undefined, page: 1 });

  const { data = { data: [], pagination: {} }, isLoading } = useQuery({
    queryKey: ['collectibles', 'search', filters],
    queryFn: () => listCollectibles({ keyword: filters.keyword, status: filters.status, page: filters.page, limit: 10 })
  });

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3}>搜索藏品</Typography.Title>
        <Typography.Paragraph type="secondary">按照藏品编号、名称或品牌来检索区块链登记信息。</Typography.Paragraph>
      </div>
  <Card variant="borderless">
        <Form layout="inline" onValuesChange={(changed, all) => setFilters({ ...filters, ...all, page: 1 })} initialValues={filters}>
          <Form.Item name="keyword">
            <Input.Search placeholder="输入名称或编号" allowClear onSearch={(value) => setFilters((prev) => ({ ...prev, keyword: value, page: 1 }))} />
          </Form.Item>
          <Form.Item name="status">
            <Select style={{ width: 160 }} options={statusOptions} placeholder="状态筛选" allowClear />
          </Form.Item>
        </Form>
      </Card>

  <Card variant="borderless" style={{ marginTop: 24 }}>
        <Table
          rowKey={(record) => record.blockchain_id || record.id}
          columns={columns}
          loading={isLoading}
          dataSource={data.data}
          pagination={{
            current: filters.page,
            pageSize: 10,
            total: data.pagination.total,
            onChange: (page) => setFilters((prev) => ({ ...prev, page }))
          }}
        />
      </Card>
    </div>
  );
};

export default SearchCollectibles;
