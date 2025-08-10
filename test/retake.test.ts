import * as cdk from 'aws-cdk-lib';
import { RetakeStack } from '../lib/retake-stack';

test('Snapshot test for RetakeStack', () => {
  const app = new cdk.App();
  const stack = new RetakeStack(app, 'RetakeStack');

  const template = cdk.assertions.Template.fromStack(stack);

  expect(template.toJSON()).toMatchSnapshot();
});