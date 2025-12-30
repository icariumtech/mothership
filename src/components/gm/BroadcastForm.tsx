import { useState } from 'react';
import { Form, Input, Select, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { BroadcastMessage } from '@/types/gmConsole';

const { TextArea } = Input;

interface BroadcastFormProps {
  onSubmit: (message: BroadcastMessage) => Promise<void>;
}

export function BroadcastForm({ onSubmit }: BroadcastFormProps) {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: { sender: string; priority: string; content: string }) => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        sender: values.sender,
        priority: values.priority as BroadcastMessage['priority'],
        content: values.content
      });
      form.setFieldValue('content', ''); // Clear message after successful send
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ sender: 'CHARON', priority: 'NORMAL', content: '' }}
      onFinish={handleSubmit}
    >
      <div style={{ display: 'flex', gap: 16 }}>
        <Form.Item
          name="sender"
          label="Sender"
          style={{ flex: 1 }}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="priority"
          label="Priority"
          style={{ width: 150 }}
        >
          <Select>
            <Select.Option value="LOW">LOW</Select.Option>
            <Select.Option value="NORMAL">NORMAL</Select.Option>
            <Select.Option value="HIGH">HIGH</Select.Option>
            <Select.Option value="CRITICAL">CRITICAL</Select.Option>
          </Select>
        </Form.Item>
      </div>

      <Form.Item
        name="content"
        label="Message"
        rules={[{ required: true, message: 'Message content is required' }]}
      >
        <TextArea rows={6} placeholder="Enter broadcast message..." />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
        <Button
          type="primary"
          htmlType="submit"
          loading={isSubmitting}
          icon={<SendOutlined />}
        >
          {isSubmitting ? 'Transmitting...' : 'TRANSMIT'}
        </Button>
      </Form.Item>
    </Form>
  );
}
